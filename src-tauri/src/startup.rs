//! Windows başlangıcında otomatik çalıştırma (HKCU\...\Run).

use winreg::{enums::*, RegKey};

const RUN_PATH: &str = r"Software\Microsoft\Windows\CurrentVersion\Run";
const VALUE_NAME: &str = "DemetLauncher";

pub fn is_enabled() -> bool {
    RegKey::predef(HKEY_CURRENT_USER)
        .open_subkey(RUN_PATH)
        .and_then(|key| key.get_value::<String, _>(VALUE_NAME))
        .is_ok()
}

pub fn set_enabled(enable: bool, start_minimized: bool) -> bool {
    let Ok(key) = RegKey::predef(HKEY_CURRENT_USER)
        .open_subkey_with_flags(RUN_PATH, KEY_READ | KEY_WRITE)
    else {
        return false;
    };

    if enable {
        let Ok(exe) = std::env::current_exe() else {
            return false;
        };
        let suffix = if start_minimized { " --minimized" } else { "" };
        key.set_value(VALUE_NAME, &format!("\"{}\"{}", exe.display(), suffix))
            .is_ok()
    } else {
        match key.delete_value(VALUE_NAME) {
            Ok(()) => true,
            Err(e) => e.kind() == std::io::ErrorKind::NotFound,
        }
    }
}
