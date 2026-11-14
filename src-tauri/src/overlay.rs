//! Hızlı seçim penceresi: imlecin yanında açılır, odak kaybında kapanır.

use crate::AppState;
use std::{
    mem::size_of,
    time::{Duration, Instant},
};
use tauri::{
    AppHandle, Emitter, Manager, PhysicalPosition, WebviewUrl, WebviewWindow, WebviewWindowBuilder,
};
use windows::Win32::{
    Foundation::POINT,
    Graphics::Gdi::{GetMonitorInfoW, MonitorFromPoint, MONITORINFO, MONITOR_DEFAULTTONEAREST},
    UI::WindowsAndMessaging::GetCursorPos,
};

pub const LABEL: &str = "overlay";
const WIDTH: f64 = 460.0;
const HEIGHT: f64 = 520.0;
/// Pencere açılırken sahte odak kaybı olaylarını yok saymak için.
const BLUR_GUARD: Duration = Duration::from_millis(400);

pub fn create(app: &AppHandle) -> tauri::Result<()> {
    WebviewWindowBuilder::new(app, LABEL, WebviewUrl::App("index.html?view=overlay".into()))
        .title("Demet Hızlı Seçim")
        .inner_size(WIDTH, HEIGHT)
        .resizable(false)
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .visible(false)
        .build()?;
    Ok(())
}

pub fn toggle(app: &AppHandle) {
    let Some(window) = app.get_webview_window(LABEL) else {
        return;
    };
    if window.is_visible().unwrap_or(false) {
        let _ = window.hide();
    } else {
        show_at_cursor(app, &window);
    }
}

pub fn hide(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(LABEL) {
        let _ = window.hide();
    }
}

/// Odak kaybında çağrılır (pencere olay dinleyicisinden).
pub fn on_blur(app: &AppHandle) {
    let state = app.state::<AppState>();
    let recently_shown = state
        .overlay_shown_at
        .lock()
        .unwrap()
        .map(|t| t.elapsed() < BLUR_GUARD)
        .unwrap_or(false);
    if !recently_shown {
        hide(app);
    }
}

fn show_at_cursor(app: &AppHandle, window: &WebviewWindow) {
    unsafe {
        let mut cursor = POINT::default();
        if GetCursorPos(&mut cursor).is_ok() {
            let size = window.outer_size().ok();
            let (w, h) = size
                .map(|s| (s.width as i32, s.height as i32))
                .unwrap_or((WIDTH as i32, HEIGHT as i32));

            let monitor = MonitorFromPoint(cursor, MONITOR_DEFAULTTONEAREST);
            let mut info = MONITORINFO {
                cbSize: size_of::<MONITORINFO>() as u32,
                ..Default::default()
            };
            if GetMonitorInfoW(monitor, &mut info).as_bool() {
                let work = info.rcWork;
                let margin = 8;
                let x = (cursor.x - w / 2)
                    .clamp(work.left + margin, (work.right - w - margin).max(work.left + margin));
                let y = (cursor.y - 30)
                    .clamp(work.top + margin, (work.bottom - h - margin).max(work.top + margin));
                let _ = window.set_position(PhysicalPosition::new(x, y));
            }
        }
    }

    *app.state::<AppState>().overlay_shown_at.lock().unwrap() = Some(Instant::now());
    let _ = window.show();
    if let Ok(hwnd) = window.hwnd() {
        crate::winutil::focus_window(hwnd.0 as isize, false);
    }
    let _ = window.set_focus();
    let _ = window.emit("overlay-show", ());
}
