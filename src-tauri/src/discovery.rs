//! Açık uygulamaları ve Başlat menüsündeki yüklü uygulamaları bulur.

use crate::winutil;
use serde::Serialize;
use std::{
    collections::{HashMap, HashSet},
    fs,
    path::{Path, PathBuf},
    sync::Mutex,
};

#[derive(Serialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveredApp {
    pub name: String,
    pub window_title: String,
    pub executable_path: String,
    pub arguments: String,
    pub working_directory: String,
    pub process_id: u32,
    /// Simgesi çıkarılacak dosya yolu (`get_icon` komutuna verilir).
    pub icon_source: String,
}

const EXCLUDED_PROCESSES: &[&str] = &[
    "explorer",
    "applicationframehost",
    "textinputhost",
    "shellexperiencehost",
    "searchhost",
    "startmenuexperiencehost",
    "lockapp",
    "systemsettings",
    "widgets",
    "securityhealthsystray",
    "demet",
];

fn file_stem(path: &str) -> String {
    Path::new(path)
        .file_stem()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_default()
}

fn friendly_name(exe_path: &str, fallback: &str) -> String {
    let (description, product) = winutil::version_strings(exe_path);
    description.or(product).unwrap_or_else(|| fallback.to_string())
}

pub fn open_applications() -> Vec<DiscoveredApp> {
    let self_pid = std::process::id();
    let mut by_path: HashMap<String, DiscoveredApp> = HashMap::new();

    for window in winutil::enum_app_windows() {
        if window.pid == 0 || window.pid == self_pid {
            continue;
        }
        let Some(exe) = winutil::process_exe_path(window.pid) else {
            continue;
        };
        if !Path::new(&exe).exists() {
            continue;
        }
        let stem = file_stem(&exe);
        if EXCLUDED_PROCESSES.contains(&stem.to_lowercase().as_str()) {
            continue;
        }
        by_path.entry(exe.to_lowercase()).or_insert_with(|| DiscoveredApp {
            name: friendly_name(&exe, &stem),
            window_title: window.title.clone(),
            working_directory: Path::new(&exe)
                .parent()
                .map(|p| p.to_string_lossy().into_owned())
                .unwrap_or_default(),
            process_id: window.pid,
            icon_source: exe.clone(),
            executable_path: exe,
            arguments: String::new(),
        });
    }

    let mut list: Vec<_> = by_path.into_values().collect();
    list.sort_by_key(|a| a.name.to_lowercase());
    list
}

// ---------------------------------------------------------------- Başlat menüsü

static START_MENU_CACHE: Mutex<Option<Vec<DiscoveredApp>>> = Mutex::new(None);
static SCAN_LOCK: Mutex<()> = Mutex::new(());

pub fn installed_apps(force_refresh: bool) -> Vec<DiscoveredApp> {
    if !force_refresh {
        if let Some(cached) = START_MENU_CACHE.lock().unwrap().clone() {
            return cached;
        }
    }
    // Aynı anda tek tarama; bekleyen çağrı sonucu önbellekten alır.
    let _guard = SCAN_LOCK.lock().unwrap();
    if !force_refresh {
        if let Some(cached) = START_MENU_CACHE.lock().unwrap().clone() {
            return cached;
        }
    }
    let scanned = scan_start_menu();
    *START_MENU_CACHE.lock().unwrap() = Some(scanned.clone());
    scanned
}

pub fn prewarm() {
    std::thread::spawn(|| {
        let _ = installed_apps(false);
    });
}

fn collect_lnk_files(dir: &Path, out: &mut Vec<PathBuf>) {
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            collect_lnk_files(&path, out);
        } else if path
            .extension()
            .map(|e| e.eq_ignore_ascii_case("lnk"))
            .unwrap_or(false)
        {
            out.push(path);
        }
    }
}

fn best_icon_source(lnk: &str, target: &str, icon_location: &str) -> String {
    if !icon_location.trim().is_empty() {
        let before_comma = icon_location.split(',').next().unwrap_or("");
        let candidate = winutil::expand_env(before_comma.trim().trim_matches('"'));
        if !candidate.is_empty() && Path::new(&candidate).exists() {
            return candidate;
        }
    }
    let generic_updater = target.to_lowercase().ends_with("update.exe");
    if !generic_updater && Path::new(target).exists() {
        return target.to_string();
    }
    lnk.to_string()
}

fn scan_start_menu() -> Vec<DiscoveredApp> {
    let roots = [
        std::env::var("APPDATA")
            .ok()
            .map(|p| PathBuf::from(p).join("Microsoft\\Windows\\Start Menu\\Programs")),
        std::env::var("ProgramData")
            .ok()
            .map(|p| PathBuf::from(p).join("Microsoft\\Windows\\Start Menu\\Programs")),
    ];

    let mut seen = HashSet::new();
    let mut apps = Vec::new();

    for root in roots.into_iter().flatten() {
        let mut files = Vec::new();
        collect_lnk_files(&root, &mut files);

        for lnk in files {
            let name = file_stem(&lnk.to_string_lossy());
            let lower = name.to_lowercase();
            if ["uninstall", "kaldır", "readme", "help"]
                .iter()
                .any(|bad| lower.contains(bad))
            {
                continue;
            }

            let lnk_str = lnk.to_string_lossy().into_owned();
            let info = winutil::resolve_shortcut(&lnk_str).unwrap_or_default();
            let target = if !info.target.is_empty() && Path::new(&info.target).exists() {
                info.target.clone()
            } else {
                lnk_str.clone()
            };

            let ext = Path::new(&target)
                .extension()
                .map(|e| e.to_string_lossy().to_lowercase())
                .unwrap_or_default();
            if ext != "exe" && ext != "lnk" {
                continue;
            }

            if !seen.insert(format!("{lower}|{}", target.to_lowercase())) {
                continue;
            }

            apps.push(DiscoveredApp {
                name,
                window_title: "Başlat Menüsü Uygulaması".into(),
                icon_source: best_icon_source(&lnk_str, &target, &info.icon_location),
                executable_path: target,
                arguments: info.arguments,
                working_directory: info.working_dir,
                process_id: 0,
            });
        }
    }

    apps.sort_by_key(|a| a.name.to_lowercase());
    apps
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_icon_for_system_exe() {
        let icon = winutil::icon_data_url("notepad.exe").expect("simge çıkarılamadı");
        assert!(icon.starts_with("data:image/png;base64,"));
        assert!(icon.len() > 200);
    }

    /// Kurulu uygulamalara bağlı: GitHub'ın boş Windows makinesinde çalışmaz.
    /// Yerelde çalıştır: `cargo test --lib -- --ignored`
    #[test]
    #[ignore = "masaüstüne kurulu uygulamalar gerektirir"]
    fn finds_start_menu_apps_with_names_and_targets() {
        let apps = installed_apps(true);
        assert!(!apps.is_empty(), "Başlat menüsünde uygulama bulunamadı");
        assert!(apps.iter().all(|a| !a.name.is_empty() && !a.executable_path.is_empty()));
        let with_icon = apps.iter().take(10).filter(|a| winutil::icon_data_url(&a.icon_source).is_some()).count();
        assert!(with_icon > 0, "hiçbir uygulama için simge çıkmadı");
    }

    #[test]
    fn lists_open_windows_and_processes() {
        assert!(!winutil::list_processes().is_empty());
        let _ = open_applications(); // çökmeden çalışmalı
        assert_eq!(winutil::expand_env("%SystemRoot%").to_lowercase().contains("windows"), true);
    }

    #[test]
    #[ignore = "masaüstüne kurulu uygulamalar gerektirir"]
    fn resolves_a_real_shortcut() {
        let lnk = installed_apps(false)
            .into_iter()
            .find(|a| a.executable_path.to_lowercase().ends_with(".exe"))
            .expect("exe hedefli kısayol yok");
        assert!(std::path::Path::new(&lnk.executable_path).exists());
    }
}
