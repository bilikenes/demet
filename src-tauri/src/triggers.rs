//! Global tetikleyiciler: klavye kısayolları (RegisterHotKey) ve fare düşük seviye kancası.
//!
//! Hepsi tek bir özel iş parçacığında, kendi mesaj döngüsüyle çalışır. Kısayollar
//! iş parçacığına bağlı kaydedildiği ve LL kanca aynı iş parçacığının mesaj
//! döngüsüne ihtiyaç duyduğu için yapılandırma değişiklikleri `PostThreadMessageW`
//! ile bu iş parçacığına iletilir.

use crate::{config::MouseTriggerMode, hotkey, launcher_events, overlay};
use std::{
    collections::HashMap,
    ffi::c_void,
    sync::{
        atomic::{AtomicIsize, AtomicU32, AtomicU8, Ordering},
        mpsc, Mutex,
    },
    time::Duration,
};
use tauri::AppHandle;
use windows::Win32::{
    Foundation::{LPARAM, LRESULT, WPARAM},
    System::{LibraryLoader::GetModuleHandleW, Threading::GetCurrentThreadId},
    UI::{
        Input::KeyboardAndMouse::{
            GetAsyncKeyState, RegisterHotKey, UnregisterHotKey, HOT_KEY_MODIFIERS, VK_CONTROL,
            VK_MENU, VK_SHIFT,
        },
        WindowsAndMessaging::{
            CallNextHookEx, GetMessageW, PeekMessageW, PostThreadMessageW, SetWindowsHookExW,
            UnhookWindowsHookEx, HHOOK, MSG, MSLLHOOKSTRUCT, PM_NOREMOVE, WH_MOUSE_LL, WM_APP,
            WM_HOTKEY, WM_MBUTTONDOWN, WM_RBUTTONDOWN, WM_USER, WM_XBUTTONDOWN,
        },
    },
};

const WM_APPLY: u32 = WM_APP + 1;
const WM_OVERLAY: u32 = WM_APP + 2;
const MOD_NOREPEAT: u32 = 0x4000;
const OVERLAY_HOTKEY_ID: i32 = 9000;
const BUNDLE_HOTKEY_BASE_ID: i32 = 9100;

static THREAD_ID: AtomicU32 = AtomicU32::new(0);
static MOUSE_MODE: AtomicU8 = AtomicU8::new(MODE_DISABLED);
static HOOK: AtomicIsize = AtomicIsize::new(0);
static PENDING: Mutex<Option<(TriggerConfig, mpsc::Sender<Vec<String>>)>> = Mutex::new(None);

const MODE_CTRL_MIDDLE: u8 = 0;
const MODE_ALT_MIDDLE: u8 = 1;
const MODE_CTRL_SHIFT_RIGHT: u8 = 2;
const MODE_CTRL_XBUTTON: u8 = 3;
const MODE_DISABLED: u8 = 4;

#[derive(Clone, Debug)]
pub struct TriggerConfig {
    pub overlay_hotkey: String,
    /// (demet id, demet adı, kısayol)
    pub bundles: Vec<(String, String, String)>,
    pub mouse: MouseTriggerMode,
}

pub fn start(app: AppHandle) {
    let (ready_tx, ready_rx) = mpsc::channel::<()>();
    std::thread::Builder::new()
        .name("demet-triggers".into())
        .spawn(move || thread_main(app, ready_tx))
        .expect("tetikleyici iş parçacığı başlatılamadı");
    let _ = ready_rx.recv_timeout(Duration::from_secs(5));
}

/// Yapılandırmayı uygular; kaydedilemeyen kısayollar için uyarı metinleri döndürür.
pub fn apply(config: TriggerConfig) -> Vec<String> {
    let thread_id = THREAD_ID.load(Ordering::SeqCst);
    if thread_id == 0 {
        return vec!["Global kısayol sistemi başlatılamadı.".into()];
    }
    let (tx, rx) = mpsc::channel();
    *PENDING.lock().unwrap() = Some((config, tx));
    unsafe {
        if PostThreadMessageW(thread_id, WM_APPLY, WPARAM(0), LPARAM(0)).is_err() {
            return vec!["Global kısayol sistemine ulaşılamadı.".into()];
        }
    }
    rx.recv_timeout(Duration::from_secs(3))
        .unwrap_or_else(|_| vec!["Kısayollar zamanında uygulanamadı.".into()])
}

fn thread_main(app: AppHandle, ready: mpsc::Sender<()>) {
    unsafe {
        // Mesaj kuyruğunu oluştur, sonra iş parçacığı kimliğini yayınla.
        let mut msg = MSG::default();
        let _ = PeekMessageW(&mut msg, None, WM_USER, WM_USER, PM_NOREMOVE);
        THREAD_ID.store(GetCurrentThreadId(), Ordering::SeqCst);
        let _ = ready.send(());

        let mut registered: Vec<i32> = Vec::new();
        let mut bundle_ids: HashMap<i32, String> = HashMap::new();

        while GetMessageW(&mut msg, None, 0, 0).0 > 0 {
            match msg.message {
                WM_HOTKEY => {
                    let id = msg.wParam.0 as i32;
                    if id == OVERLAY_HOTKEY_ID {
                        overlay::toggle(&app);
                    } else if let Some(bundle_id) = bundle_ids.get(&id) {
                        launcher_events::spawn_launch(&app, bundle_id.clone());
                    }
                }
                WM_OVERLAY => overlay::toggle(&app),
                WM_APPLY => {
                    let pending = PENDING.lock().unwrap().take();
                    if let Some((config, reply)) = pending {
                        let warnings = apply_on_thread(&config, &mut registered, &mut bundle_ids);
                        let _ = reply.send(warnings);
                    }
                }
                _ => {}
            }
        }

        for id in registered {
            let _ = UnregisterHotKey(None, id);
        }
        uninstall_hook();
    }
}

unsafe fn apply_on_thread(
    config: &TriggerConfig,
    registered: &mut Vec<i32>,
    bundle_ids: &mut HashMap<i32, String>,
) -> Vec<String> {
    let mut warnings = Vec::new();

    for id in registered.drain(..) {
        let _ = UnregisterHotKey(None, id);
    }
    bundle_ids.clear();

    let register = |id: i32, text: &str| -> Option<bool> {
        let (mods, vk) = hotkey::parse(text)?;
        let ok = RegisterHotKey(None, id, HOT_KEY_MODIFIERS(mods | MOD_NOREPEAT), vk).is_ok();
        Some(ok)
    };

    if !config.overlay_hotkey.trim().is_empty() {
        match register(OVERLAY_HOTKEY_ID, &config.overlay_hotkey) {
            Some(true) => registered.push(OVERLAY_HOTKEY_ID),
            Some(false) => warnings.push(format!(
                "Hızlı Menü kısayolu ({}) başka bir uygulama tarafından kullanılıyor olabilir.",
                config.overlay_hotkey
            )),
            None => {}
        }
    }

    for (index, (bundle_id, name, text)) in config.bundles.iter().enumerate() {
        if text.trim().is_empty() {
            continue;
        }
        let id = BUNDLE_HOTKEY_BASE_ID + index as i32;
        match register(id, text) {
            Some(true) => {
                registered.push(id);
                bundle_ids.insert(id, bundle_id.clone());
            }
            Some(false) => warnings.push(format!("'{name}' demetinin kısayolu ({text}) kaydedilemedi.")),
            None => {}
        }
    }

    let mode = match config.mouse {
        MouseTriggerMode::CtrlMiddleClick => MODE_CTRL_MIDDLE,
        MouseTriggerMode::AltMiddleClick => MODE_ALT_MIDDLE,
        MouseTriggerMode::CtrlShiftRightClick => MODE_CTRL_SHIFT_RIGHT,
        MouseTriggerMode::CtrlXButton1 => MODE_CTRL_XBUTTON,
        MouseTriggerMode::Disabled => MODE_DISABLED,
    };
    MOUSE_MODE.store(mode, Ordering::SeqCst);
    if mode == MODE_DISABLED {
        uninstall_hook();
    } else {
        install_hook();
    }

    warnings
}

unsafe fn install_hook() {
    if HOOK.load(Ordering::SeqCst) != 0 {
        return;
    }
    let module = GetModuleHandleW(None).ok();
    if let Ok(hook) = SetWindowsHookExW(WH_MOUSE_LL, Some(mouse_proc), module.map(Into::into), 0) {
        HOOK.store(hook.0 as isize, Ordering::SeqCst);
    }
}

unsafe fn uninstall_hook() {
    let raw = HOOK.swap(0, Ordering::SeqCst);
    if raw != 0 {
        let _ = UnhookWindowsHookEx(HHOOK(raw as *mut c_void));
    }
}

fn key_down(vk: u16) -> bool {
    unsafe { (GetAsyncKeyState(vk as i32) as u16 & 0x8000) != 0 }
}

unsafe extern "system" fn mouse_proc(code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
    if code >= 0 {
        let message = wparam.0 as u32;
        let matched = match MOUSE_MODE.load(Ordering::Relaxed) {
            MODE_CTRL_MIDDLE => message == WM_MBUTTONDOWN && key_down(VK_CONTROL.0),
            MODE_ALT_MIDDLE => message == WM_MBUTTONDOWN && key_down(VK_MENU.0),
            MODE_CTRL_SHIFT_RIGHT => {
                message == WM_RBUTTONDOWN && key_down(VK_CONTROL.0) && key_down(VK_SHIFT.0)
            }
            MODE_CTRL_XBUTTON => {
                if message == WM_XBUTTONDOWN && key_down(VK_CONTROL.0) {
                    let info = &*(lparam.0 as *const MSLLHOOKSTRUCT);
                    let button = (info.mouseData >> 16) & 0xFFFF;
                    button == 1 || button == 2
                } else {
                    false
                }
            }
            _ => false,
        };

        if matched {
            let _ = PostThreadMessageW(
                THREAD_ID.load(Ordering::Relaxed),
                WM_OVERLAY,
                WPARAM(0),
                LPARAM(0),
            );
            return LRESULT(1);
        }
    }
    CallNextHookEx(None, code, wparam, lparam)
}
