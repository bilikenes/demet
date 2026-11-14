//! Demetleri arka planda çalıştırır ve sonucu arayüze olay olarak bildirir.

use crate::{launcher, AppState};
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BundleEvent {
    /// "launch" | "close"
    pub kind: &'static str,
    pub bundle_name: String,
    #[serde(flatten)]
    pub result: launcher::BundleResult,
}

fn find_bundle(app: &AppHandle, bundle_id: &str) -> Option<crate::config::AppBundle> {
    let state = app.state::<AppState>();
    let config = state.config.lock().unwrap();
    config.bundles.iter().find(|b| b.id == bundle_id).cloned()
}

pub fn spawn_launch(app: &AppHandle, bundle_id: String) {
    let app = app.clone();
    std::thread::spawn(move || {
        let Some(bundle) = find_bundle(&app, &bundle_id) else {
            return;
        };
        let _ = app.emit(
            "bundle-started",
            serde_json::json!({ "bundleName": bundle.name }),
        );
        let result = launcher::launch_bundle(&bundle);
        let _ = app.emit(
            "bundle-result",
            BundleEvent {
                kind: "launch",
                bundle_name: bundle.name,
                result,
            },
        );
    });
}

pub fn spawn_close(app: &AppHandle, bundle_id: String) {
    let app = app.clone();
    std::thread::spawn(move || {
        let Some(bundle) = find_bundle(&app, &bundle_id) else {
            return;
        };
        let result = launcher::close_bundle(&bundle);
        let _ = app.emit(
            "bundle-result",
            BundleEvent {
                kind: "close",
                bundle_name: bundle.name,
                result,
            },
        );
    });
}
