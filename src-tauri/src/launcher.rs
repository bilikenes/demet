//! Demet başlatma ve kapatma mantığı.

use crate::{
    config::{AppBundle, BundleItem, BundleItemType, DuplicateBehavior},
    winutil,
};
use serde::Serialize;
use std::{collections::HashSet, path::Path, thread, time::Duration};

#[derive(Serialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct BundleResult {
    pub launched_count: u32,
    pub focused_or_skipped_count: u32,
    pub closed_count: u32,
    pub errors: Vec<String>,
}

fn file_stem(path: &str) -> String {
    Path::new(path)
        .file_stem()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_default()
}

/// `.lnk` ise hedef exe'ye, değilse ortam değişkenleri açılmış yola çevirir.
fn resolve_executable_target(raw: &str) -> String {
    let expanded = winutil::expand_env(raw.trim());
    if expanded.to_lowercase().ends_with(".lnk") && Path::new(&expanded).exists() {
        if let Some(info) = winutil::resolve_shortcut(&expanded) {
            if !info.target.is_empty() {
                return info.target;
            }
        }
    }
    expanded
}

enum Done {
    Launched,
    Focused,
}

pub fn launch_bundle(bundle: &AppBundle) -> BundleResult {
    let mut result = BundleResult::default();
    let items: Vec<&BundleItem> = bundle.items.iter().filter(|i| i.enabled).collect();

    for (index, item) in items.iter().enumerate() {
        let outcome: Result<Done, String> = match item.item_type {
            BundleItemType::Url => launch_url(&item.target).map(|_| Done::Launched),
            BundleItemType::Folder => launch_folder(&item.target).map(|_| Done::Launched),
            BundleItemType::Application => {
                let mut focused = false;
                if item.duplicate_behavior == DuplicateBehavior::FocusOrSkip {
                    let (window, running_without_window) = find_running_window(item);
                    if let Some(hwnd) = window {
                        winutil::focus_window(hwnd, true);
                        focused = true;
                    } else if running_without_window {
                        focused = true;
                    }
                }
                if focused {
                    Ok(Done::Focused)
                } else {
                    launch_application(item).map(|_| Done::Launched)
                }
            }
        };

        match outcome {
            Ok(Done::Launched) => result.launched_count += 1,
            Ok(Done::Focused) => result.focused_or_skipped_count += 1,
            Err(message) => result.errors.push(format!("{}: {}", item.name, message)),
        }

        if index + 1 < items.len() && item.delay_ms > 0 {
            thread::sleep(Duration::from_millis(item.delay_ms.clamp(0, 15_000) as u64));
        }
    }

    result
}

pub fn close_bundle(bundle: &AppBundle) -> BundleResult {
    let mut result = BundleResult::default();
    let self_pid = std::process::id();
    let processes = winutil::list_processes();
    let windows = winutil::enum_app_windows();

    for item in bundle
        .items
        .iter()
        .filter(|i| i.enabled && i.item_type == BundleItemType::Application)
    {
        let resolved = resolve_executable_target(&item.target);
        let stem = file_stem(&resolved).to_lowercase();
        if stem.is_empty() || stem == "explorer" || stem == "demet" {
            continue;
        }

        let pids: HashSet<u32> = processes
            .iter()
            .filter(|(pid, exe)| *pid != self_pid && file_stem(exe).to_lowercase() == stem)
            .map(|(pid, _)| *pid)
            .collect();
        if pids.is_empty() {
            continue;
        }

        for window in windows.iter().filter(|w| pids.contains(&w.pid)) {
            if winutil::close_window(window.hwnd) {
                result.closed_count += 1;
            }
        }
    }

    result
}

fn launch_url(raw: &str) -> Result<(), String> {
    let mut url = raw.trim().to_string();
    let lower = url.to_lowercase();
    if !lower.starts_with("http://") && !lower.starts_with("https://") {
        url = format!("https://{url}");
    }
    winutil::shell_open(&url, "", "")
}

fn launch_folder(raw: &str) -> Result<(), String> {
    let expanded = winutil::expand_env(raw.trim());
    winutil::shell_open("explorer.exe", &format!("\"{expanded}\""), "")
}

fn launch_application(item: &BundleItem) -> Result<(), String> {
    let target = winutil::expand_env(item.target.trim());
    let mut work_dir = if item.working_directory.trim().is_empty() {
        String::new()
    } else {
        winutil::expand_env(item.working_directory.trim())
    };

    if work_dir.is_empty() && Path::new(&target).is_absolute() {
        if let Some(dir) = Path::new(&target).parent() {
            if dir.is_dir() {
                work_dir = dir.to_string_lossy().into_owned();
            }
        }
    }
    if !work_dir.is_empty() && !Path::new(&work_dir).is_dir() {
        work_dir.clear();
    }

    winutil::shell_open(&target, &item.arguments, &work_dir)
}

/// (bulunan pencere, süreç çalışıyor ama pencere yok)
fn find_running_window(item: &BundleItem) -> (Option<isize>, bool) {
    let resolved = resolve_executable_target(&item.target);
    let stem = file_stem(&resolved).to_lowercase();
    if stem.is_empty() {
        return (None, false);
    }

    let has_full_path = Path::new(&resolved).is_absolute() && Path::new(&resolved).exists();

    let matching: HashSet<u32> = winutil::list_processes()
        .into_iter()
        .filter(|(_, exe)| file_stem(exe).to_lowercase() == stem)
        .filter(|(pid, _)| {
            if !has_full_path {
                return true;
            }
            match winutil::process_exe_path(*pid) {
                Some(running) if !running.is_empty() => running.eq_ignore_ascii_case(&resolved),
                _ => true,
            }
        })
        .map(|(pid, _)| pid)
        .collect();

    if matching.is_empty() {
        return (None, false);
    }

    let window = winutil::enum_app_windows()
        .into_iter()
        .find(|w| matching.contains(&w.pid));
    match window {
        Some(w) => (Some(w.hwnd), false),
        None => (None, true),
    }
}
