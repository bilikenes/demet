//! Yapılandırma modeli ve diske kaydetme.
//!
//! Dosya konumu ve alan adları eski WPF sürümüyle uyumludur
//! (`%APPDATA%\Demet\config.json`): eski PascalCase alanlar okunur,
//! yeni dosya camelCase yazılır (eski sürüm büyük/küçük harfe duyarsız okur).

use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::PathBuf,
    sync::atomic::{AtomicU64, Ordering},
    time::{SystemTime, UNIX_EPOCH},
};

#[derive(Serialize, Deserialize, Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum BundleItemType {
    #[default]
    Application,
    Url,
    Folder,
}

#[derive(Serialize, Deserialize, Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum DuplicateBehavior {
    #[default]
    FocusOrSkip,
    AlwaysLaunch,
}

#[derive(Serialize, Deserialize, Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum MouseTriggerMode {
    #[default]
    CtrlMiddleClick,
    AltMiddleClick,
    CtrlShiftRightClick,
    CtrlXButton1,
    Disabled,
}

pub fn new_id() -> String {
    static COUNTER: AtomicU64 = AtomicU64::new(0);
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let c = COUNTER.fetch_add(1, Ordering::Relaxed) as u128;
    format!(
        "{:032x}",
        nanos.wrapping_mul(0x9E37_79B9_7F4A_7C15).wrapping_add(c)
    )
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase", default)]
pub struct BundleItem {
    #[serde(alias = "Id")]
    pub id: String,
    #[serde(alias = "Name")]
    pub name: String,
    #[serde(alias = "ItemType")]
    pub item_type: BundleItemType,
    #[serde(alias = "Target")]
    pub target: String,
    #[serde(alias = "Arguments")]
    pub arguments: String,
    #[serde(alias = "WorkingDirectory")]
    pub working_directory: String,
    #[serde(alias = "DuplicateBehavior")]
    pub duplicate_behavior: DuplicateBehavior,
    #[serde(alias = "DelayMs")]
    pub delay_ms: i32,
    #[serde(alias = "Enabled")]
    pub enabled: bool,
}

impl Default for BundleItem {
    fn default() -> Self {
        Self {
            id: new_id(),
            name: String::new(),
            item_type: BundleItemType::Application,
            target: String::new(),
            arguments: String::new(),
            working_directory: String::new(),
            duplicate_behavior: DuplicateBehavior::FocusOrSkip,
            delay_ms: 250,
            enabled: true,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase", default)]
pub struct AppBundle {
    #[serde(alias = "Id")]
    pub id: String,
    #[serde(alias = "Name")]
    pub name: String,
    #[serde(alias = "Description")]
    pub description: String,
    #[serde(alias = "IconEmoji")]
    pub icon_emoji: String,
    #[serde(alias = "Hotkey")]
    pub hotkey: String,
    #[serde(alias = "LaunchOnStartup")]
    pub launch_on_startup: bool,
    #[serde(alias = "Items")]
    pub items: Vec<BundleItem>,
}

impl Default for AppBundle {
    fn default() -> Self {
        Self {
            id: new_id(),
            name: "Yeni Demet".into(),
            description: String::new(),
            icon_emoji: "rocket".into(),
            hotkey: String::new(),
            launch_on_startup: false,
            items: Vec::new(),
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase", default)]
pub struct AppConfig {
    #[serde(alias = "OverlayHotkey")]
    pub overlay_hotkey: String,
    #[serde(alias = "MouseTrigger")]
    pub mouse_trigger: MouseTriggerMode,
    #[serde(alias = "MinimizeToTrayOnClose")]
    pub minimize_to_tray_on_close: bool,
    #[serde(alias = "StartMinimized")]
    pub start_minimized: bool,
    #[serde(alias = "Bundles")]
    pub bundles: Vec<AppBundle>,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            overlay_hotkey: "Ctrl+Alt+Space".into(),
            mouse_trigger: MouseTriggerMode::CtrlMiddleClick,
            minimize_to_tray_on_close: true,
            start_minimized: false,
            bundles: Vec::new(),
        }
    }
}

fn config_dir() -> PathBuf {
    let base = std::env::var_os("APPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("."));
    base.join("Demet")
}

pub fn config_path() -> PathBuf {
    config_dir().join("config.json")
}

fn default_config() -> AppConfig {
    let documents = crate::winutil::documents_dir().unwrap_or_default();
    AppConfig {
        bundles: vec![AppBundle {
            name: "Günlük Başlangıç".into(),
            description: "Sabah bilgisayarı açtığında hızlıca başlatılacak temel araçlar".into(),
            icon_emoji: "sun".into(),
            hotkey: "Ctrl+Alt+Shift+1".into(),
            items: vec![
                BundleItem {
                    name: "Not Defteri".into(),
                    target: "notepad.exe".into(),
                    delay_ms: 200,
                    ..Default::default()
                },
                BundleItem {
                    name: "Belgelerim Klasörü".into(),
                    item_type: BundleItemType::Folder,
                    target: documents,
                    delay_ms: 200,
                    ..Default::default()
                },
                BundleItem {
                    name: "GitHub".into(),
                    item_type: BundleItemType::Url,
                    target: "https://github.com".into(),
                    delay_ms: 200,
                    ..Default::default()
                },
            ],
            ..Default::default()
        }],
        ..Default::default()
    }
}

/// Yapılandırmayı yükler. Dosya yoksa varsayılan oluşturulur; dosya okunamıyorsa
/// bozuk dosya silinmeden önce `config.json.bak` olarak yedeklenir.
pub fn load() -> AppConfig {
    let path = config_path();
    if let Ok(text) = fs::read_to_string(&path) {
        let text = text.trim_start_matches('\u{feff}');
        match serde_json::from_str::<AppConfig>(text) {
            Ok(cfg) => return cfg,
            Err(_) => {
                let _ = fs::copy(&path, path.with_extension("json.bak"));
            }
        }
    }
    let cfg = default_config();
    let _ = save(&cfg);
    cfg
}

pub fn save(config: &AppConfig) -> Result<(), String> {
    fs::create_dir_all(config_dir()).map_err(|e| e.to_string())?;
    let json = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    let path = config_path();
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, json).map_err(|e| e.to_string())?;
    fs::rename(&tmp, &path).map_err(|e| e.to_string())
}
