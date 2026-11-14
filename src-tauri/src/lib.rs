mod config;
mod discovery;
mod favicon;
mod hotkey;
mod launcher;
mod launcher_events;
mod overlay;
mod startup;
mod tray;
mod triggers;
mod winutil;

use config::AppConfig;
use discovery::DiscoveredApp;
use std::{
    collections::HashMap,
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex,
    },
    time::{Duration, Instant},
};
use tauri::{AppHandle, Manager, State, WindowEvent};

pub struct AppState {
    pub config: Mutex<AppConfig>,
    pub start_minimized: bool,
    pub main_shown: AtomicBool,
    pub overlay_shown_at: Mutex<Option<Instant>>,
    icon_cache: Mutex<HashMap<String, Option<String>>>,
}

pub fn show_dashboard(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        app.state::<AppState>().main_shown.store(true, Ordering::SeqCst);
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn trigger_config(config: &AppConfig) -> triggers::TriggerConfig {
    triggers::TriggerConfig {
        overlay_hotkey: config.overlay_hotkey.clone(),
        bundles: config
            .bundles
            .iter()
            .map(|b| (b.id.clone(), b.name.clone(), b.hotkey.clone()))
            .collect(),
        mouse: config.mouse_trigger,
    }
}

// ------------------------------------------------------------------ komutlar

#[tauri::command]
fn get_config(state: State<'_, AppState>) -> AppConfig {
    state.config.lock().unwrap().clone()
}

/// Yapılandırmayı kaydeder, kısayolları ve tepsi menüsünü yeniler.
/// Kaydedilemeyen kısayollar için uyarı listesi döndürür.
#[tauri::command]
async fn save_config(
    app: AppHandle,
    state: State<'_, AppState>,
    config: AppConfig,
) -> Result<Vec<String>, String> {
    config::save(&config)?;
    *state.config.lock().unwrap() = config.clone();
    let warnings = triggers::apply(trigger_config(&config));
    tray::rebuild(&app, &config);
    Ok(warnings)
}

#[tauri::command]
fn launch_bundle(app: AppHandle, bundle_id: String) {
    launcher_events::spawn_launch(&app, bundle_id);
}

#[tauri::command]
fn close_bundle(app: AppHandle, bundle_id: String) {
    launcher_events::spawn_close(&app, bundle_id);
}

#[tauri::command]
async fn get_open_apps() -> Result<Vec<DiscoveredApp>, String> {
    tauri::async_runtime::spawn_blocking(discovery::open_applications)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_installed_apps(force_refresh: bool) -> Result<Vec<DiscoveredApp>, String> {
    tauri::async_runtime::spawn_blocking(move || discovery::installed_apps(force_refresh))
        .await
        .map_err(|e| e.to_string())
}

/// Dosyanın simgesini PNG data URL olarak döndürür (önbellekli).
#[tauri::command]
async fn get_icon(state: State<'_, AppState>, path: String) -> Result<Option<String>, String> {
    let key = path.trim().to_lowercase();
    if key.is_empty() {
        return Ok(None);
    }
    if let Some(hit) = state.icon_cache.lock().unwrap().get(&key) {
        return Ok(hit.clone());
    }
    let lookup = path.clone();
    let icon = tauri::async_runtime::spawn_blocking(move || winutil::icon_data_url(&lookup))
        .await
        .map_err(|e| e.to_string())?;
    state.icon_cache.lock().unwrap().insert(key, icon.clone());
    Ok(icon)
}

/// Web adresinin site simgesi (data URL); bulunamazsa `None`.
#[tauri::command]
async fn get_favicon(url: String) -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || favicon::fetch(&url))
        .await
        .map_err(|e| e.to_string())
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct ShortcutTarget {
    target_path: String,
    arguments: String,
    working_directory: String,
}

#[tauri::command]
async fn resolve_shortcut(path: String) -> Result<Option<ShortcutTarget>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        winutil::resolve_shortcut(&path).map(|s| ShortcutTarget {
            target_path: s.target,
            arguments: s.arguments,
            working_directory: s.working_dir,
        })
    })
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn is_startup_enabled() -> bool {
    startup::is_enabled()
}

#[tauri::command]
fn set_startup_enabled(enable: bool) -> bool {
    startup::set_enabled(enable, true)
}

/// Kısayol atama alanı odaktayken global kısayolları geçici durdurur; böylece
/// zaten atanmış bir kombinasyona basıldığında olay arayüze ulaşır.
#[tauri::command]
async fn set_triggers_paused(state: State<'_, AppState>, paused: bool) -> Result<(), String> {
    let config = state.config.lock().unwrap().clone();
    let effective = if paused {
        triggers::TriggerConfig {
            overlay_hotkey: String::new(),
            bundles: Vec::new(),
            mouse: config::MouseTriggerMode::Disabled,
        }
    } else {
        trigger_config(&config)
    };
    triggers::apply(effective);
    Ok(())
}

#[tauri::command]
fn path_exists(path: String) -> bool {
    std::path::Path::new(&winutil::expand_env(path.trim())).exists()
}

/// Arayüz ilk kez çizildiğinde çağrılır; `--minimized` değilse paneli gösterir.
#[tauri::command]
fn app_ready(app: AppHandle, state: State<'_, AppState>) {
    if !state.start_minimized && !state.main_shown.load(Ordering::SeqCst) {
        show_dashboard(&app);
    }
}

#[tauri::command]
fn open_dashboard(app: AppHandle) {
    show_dashboard(&app);
}

#[tauri::command]
fn hide_overlay(app: AppHandle) {
    overlay::hide(&app);
}

// ------------------------------------------------------------------ uygulama

pub fn run() {
    let start_minimized = std::env::args().any(|a| a.eq_ignore_ascii_case("--minimized"));
    let initial_config = config::load();

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_dashboard(app);
        }))
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState {
            config: Mutex::new(initial_config.clone()),
            start_minimized,
            main_shown: AtomicBool::new(false),
            overlay_shown_at: Mutex::new(None),
            icon_cache: Mutex::new(HashMap::new()),
        })
        .invoke_handler(tauri::generate_handler![
            get_config,
            save_config,
            launch_bundle,
            close_bundle,
            get_open_apps,
            get_installed_apps,
            get_icon,
            get_favicon,
            resolve_shortcut,
            is_startup_enabled,
            set_startup_enabled,
            path_exists,
            set_triggers_paused,
            app_ready,
            open_dashboard,
            hide_overlay,
        ])
        .setup(move |app| {
            let handle = app.handle().clone();

            overlay::create(&handle)?;
            tray::create(&handle, &initial_config)?;

            triggers::start(handle.clone());
            let warnings = triggers::apply(trigger_config(&initial_config));
            for warning in warnings {
                eprintln!("uyarı: {warning}");
            }

            discovery::prewarm();

            // Uygulama açılınca otomatik başlayacak demetler.
            for bundle in initial_config.bundles.iter().filter(|b| b.launch_on_startup) {
                launcher_events::spawn_launch(&handle, bundle.id.clone());
            }

            // Arayüz hazır sinyali gelmezse paneli yine de göster.
            if !start_minimized {
                let fallback = handle.clone();
                std::thread::spawn(move || {
                    std::thread::sleep(Duration::from_secs(4));
                    if !fallback.state::<AppState>().main_shown.load(Ordering::SeqCst) {
                        show_dashboard(&fallback);
                    }
                });
            }
            Ok(())
        })
        .on_window_event(|window, event| match (window.label(), event) {
            ("main", WindowEvent::CloseRequested { api, .. }) => {
                let minimize = window
                    .app_handle()
                    .state::<AppState>()
                    .config
                    .lock()
                    .unwrap()
                    .minimize_to_tray_on_close;
                if minimize {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
            ("overlay", WindowEvent::Focused(false)) => overlay::on_blur(window.app_handle()),
            _ => {}
        })
        .run(tauri::generate_context!())
        .expect("Demet başlatılamadı");
}
