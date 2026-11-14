//! Sistem tepsisi simgesi ve menüsü.

use crate::{config::AppConfig, launcher_events, overlay, show_dashboard};
use tauri::{
    menu::{Menu, MenuBuilder, SubmenuBuilder},
    tray::{MouseButton, TrayIconBuilder, TrayIconEvent},
    AppHandle,
};

const TRAY_ID: &str = "main";

/// İkon alanı sembol kimliği ("rocket") ise menüde gösterilmez; emoji ise etiketin başına eklenir.
fn icon_prefix(icon: &str) -> String {
    let is_symbol_id = !icon.is_empty() && icon.chars().all(|c| c.is_ascii_alphanumeric() || c == '-');
    if icon.is_empty() || is_symbol_id {
        String::new()
    } else {
        format!("{icon} ")
    }
}

fn build_menu(app: &AppHandle, config: &AppConfig) -> tauri::Result<Menu<tauri::Wry>> {
    let mut builder = MenuBuilder::new(app)
        .text("overlay", "Hızlı Seçim Menüsünü Aç")
        .separator();

    for bundle in &config.bundles {
        let label = if bundle.hotkey.trim().is_empty() {
            format!("{}{}", icon_prefix(&bundle.icon_emoji), bundle.name)
        } else {
            format!("{}{} ({})", icon_prefix(&bundle.icon_emoji), bundle.name, bundle.hotkey)
        };
        let submenu = SubmenuBuilder::new(app, label)
            .text(format!("launch:{}", bundle.id), "Demeti Başlat")
            .text(format!("close:{}", bundle.id), "Demetteki Uygulamaları Kapat")
            .build()?;
        builder = builder.item(&submenu);
    }

    builder
        .separator()
        .text("dashboard", "Yönetim Panelini Aç")
        .text("exit", "Çıkış")
        .build()
}

pub fn create(app: &AppHandle, config: &AppConfig) -> tauri::Result<()> {
    let menu = build_menu(app, config)?;
    let mut builder = TrayIconBuilder::with_id(TRAY_ID)
        .tooltip("Demet — Uygulama Demeti Başlatıcı")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| {
            let id = event.id().as_ref();
            match id {
                "overlay" => overlay::toggle(app),
                "dashboard" => show_dashboard(app),
                "exit" => app.exit(0),
                _ => {
                    if let Some(bundle_id) = id.strip_prefix("launch:") {
                        launcher_events::spawn_launch(app, bundle_id.to_string());
                    } else if let Some(bundle_id) = id.strip_prefix("close:") {
                        launcher_events::spawn_close(app, bundle_id.to_string());
                    }
                }
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::DoubleClick {
                button: MouseButton::Left,
                ..
            } = event
            {
                show_dashboard(tray.app_handle());
            }
        });

    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    builder.build(app)?;
    Ok(())
}

pub fn rebuild(app: &AppHandle, config: &AppConfig) {
    if let (Some(tray), Ok(menu)) = (app.tray_by_id(TRAY_ID), build_menu(app, config)) {
        let _ = tray.set_menu(Some(menu));
    }
}
