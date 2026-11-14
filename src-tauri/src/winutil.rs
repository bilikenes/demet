//! Win32 yardımcıları: pencere/süreç listeleme, kısayol (.lnk) çözme, simge çıkarma,
//! dosya sürüm bilgisi ve kabuk üzerinden çalıştırma.

use base64::{engine::general_purpose::STANDARD, Engine};
use std::{
    ffi::c_void,
    mem::size_of,
    path::Path,
    ptr::null_mut,
};
use windows::{
    core::{Interface, BOOL, PCWSTR, PWSTR},
    Win32::{
        Foundation::{CloseHandle, HWND, LPARAM, WPARAM},
        Graphics::{
            Dwm::{DwmGetWindowAttribute, DWMWA_CLOAKED},
            Gdi::{
                DeleteObject, GetDC, GetDIBits, GetObjectW, ReleaseDC, BITMAP, BITMAPINFO,
                BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS, HGDIOBJ,
            },
        },
        Storage::FileSystem::{
            GetFileVersionInfoSizeW, GetFileVersionInfoW, VerQueryValueW, FILE_FLAGS_AND_ATTRIBUTES,
            WIN32_FIND_DATAW,
        },
        System::{
            Com::{
                CoCreateInstance, CoInitializeEx, CoTaskMemFree, IPersistFile, CLSCTX_INPROC_SERVER,
                COINIT_APARTMENTTHREADED, STGM_READ,
            },
            Diagnostics::ToolHelp::{
                CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
                TH32CS_SNAPPROCESS,
            },
            Environment::ExpandEnvironmentStringsW,
            Threading::{
                AttachThreadInput, GetCurrentThreadId, OpenProcess, QueryFullProcessImageNameW,
                PROCESS_NAME_WIN32, PROCESS_QUERY_LIMITED_INFORMATION,
            },
        },
        UI::{
            Shell::{
                FOLDERID_Documents, IShellLinkW, SHGetFileInfoW, SHGetKnownFolderPath, ShellExecuteW,
                ShellLink, KF_FLAG_DEFAULT, SHFILEINFOW, SHGFI_ICON, SHGFI_LARGEICON,
            },
            WindowsAndMessaging::{
                DestroyIcon, GetForegroundWindow, GetIconInfo, GetWindowLongW, GetWindowTextLengthW,
                GetWindowTextW, GetWindowThreadProcessId, IsIconic, IsWindowVisible, PostMessageW,
                SetForegroundWindow, ShowWindow, EnumWindows, GWL_EXSTYLE, HICON, ICONINFO,
                SW_RESTORE, SW_SHOWNORMAL, WM_CLOSE, WS_EX_TOOLWINDOW,
            },
        },
    },
};

pub fn wide(s: &str) -> Vec<u16> {
    s.encode_utf16().chain(std::iter::once(0)).collect()
}

fn from_buf(buf: &[u16]) -> String {
    let end = buf.iter().position(|&c| c == 0).unwrap_or(buf.len());
    String::from_utf16_lossy(&buf[..end])
}

pub fn expand_env(s: &str) -> String {
    let w = wide(s);
    unsafe {
        let needed = ExpandEnvironmentStringsW(PCWSTR(w.as_ptr()), None);
        if needed == 0 {
            return s.to_string();
        }
        let mut buf = vec![0u16; needed as usize];
        let written = ExpandEnvironmentStringsW(PCWSTR(w.as_ptr()), Some(&mut buf));
        if written == 0 {
            return s.to_string();
        }
        from_buf(&buf)
    }
}

pub fn documents_dir() -> Option<String> {
    unsafe {
        let p = SHGetKnownFolderPath(&FOLDERID_Documents, KF_FLAG_DEFAULT, None).ok()?;
        let s = p.to_string().ok();
        CoTaskMemFree(Some(p.0 as *const c_void));
        s
    }
}

// ---------------------------------------------------------------- pencereler

#[derive(Clone, Debug)]
pub struct AppWindow {
    pub hwnd: isize,
    pub title: String,
    pub pid: u32,
}

/// Görev çubuğunda görünen, başlığı olan, gizlenmemiş üst düzey pencereler.
pub fn enum_app_windows() -> Vec<AppWindow> {
    unsafe extern "system" fn callback(hwnd: HWND, lparam: LPARAM) -> BOOL {
        let list = &mut *(lparam.0 as *mut Vec<AppWindow>);

        if !IsWindowVisible(hwnd).as_bool() {
            return BOOL(1);
        }
        let ex_style = GetWindowLongW(hwnd, GWL_EXSTYLE) as u32;
        if ex_style & WS_EX_TOOLWINDOW.0 != 0 {
            return BOOL(1);
        }
        let mut cloaked: u32 = 0;
        if DwmGetWindowAttribute(
            hwnd,
            DWMWA_CLOAKED,
            &mut cloaked as *mut u32 as *mut c_void,
            size_of::<u32>() as u32,
        )
        .is_ok()
            && cloaked != 0
        {
            return BOOL(1);
        }
        let len = GetWindowTextLengthW(hwnd);
        if len <= 0 {
            return BOOL(1);
        }
        let mut buf = vec![0u16; len as usize + 1];
        let n = GetWindowTextW(hwnd, &mut buf);
        let title = String::from_utf16_lossy(&buf[..n.max(0) as usize])
            .trim()
            .to_string();
        if title.is_empty() {
            return BOOL(1);
        }
        let mut pid = 0u32;
        GetWindowThreadProcessId(hwnd, Some(&mut pid));
        list.push(AppWindow {
            hwnd: hwnd.0 as isize,
            title,
            pid,
        });
        BOOL(1)
    }

    let mut list: Vec<AppWindow> = Vec::new();
    unsafe {
        let _ = EnumWindows(Some(callback), LPARAM(&mut list as *mut Vec<AppWindow> as isize));
    }
    list
}

pub fn process_exe_path(pid: u32) -> Option<String> {
    unsafe {
        let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid).ok()?;
        let mut buf = [0u16; 1024];
        let mut size = buf.len() as u32;
        let result =
            QueryFullProcessImageNameW(handle, PROCESS_NAME_WIN32, PWSTR(buf.as_mut_ptr()), &mut size);
        let _ = CloseHandle(handle);
        result.ok()?;
        Some(String::from_utf16_lossy(&buf[..size as usize]))
    }
}

/// (pid, exe dosya adı) çiftleri.
pub fn list_processes() -> Vec<(u32, String)> {
    let mut out = Vec::new();
    unsafe {
        let Ok(snapshot) = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) else {
            return out;
        };
        let mut entry = PROCESSENTRY32W {
            dwSize: size_of::<PROCESSENTRY32W>() as u32,
            ..Default::default()
        };
        if Process32FirstW(snapshot, &mut entry).is_ok() {
            loop {
                out.push((entry.th32ProcessID, from_buf(&entry.szExeFile)));
                if Process32NextW(snapshot, &mut entry).is_err() {
                    break;
                }
            }
        }
        let _ = CloseHandle(snapshot);
    }
    out
}

pub fn close_window(hwnd: isize) -> bool {
    unsafe { PostMessageW(Some(HWND(hwnd as *mut c_void)), WM_CLOSE, WPARAM(0), LPARAM(0)).is_ok() }
}

/// Pencereyi öne getirir. Windows'un ön plan kısıtını aşmak için giriş kuyruğunu
/// geçici olarak mevcut ön plan penceresine bağlar.
pub fn focus_window(hwnd: isize, restore_if_minimized: bool) {
    unsafe {
        let hwnd = HWND(hwnd as *mut c_void);
        if restore_if_minimized && IsIconic(hwnd).as_bool() {
            let _ = ShowWindow(hwnd, SW_RESTORE);
        }
        let fg = GetForegroundWindow();
        let fg_thread = if fg.0.is_null() {
            0
        } else {
            GetWindowThreadProcessId(fg, None)
        };
        let this_thread = GetCurrentThreadId();
        let attach = fg_thread != 0 && fg_thread != this_thread;
        if attach {
            let _ = AttachThreadInput(this_thread, fg_thread, true);
        }
        let _ = SetForegroundWindow(hwnd);
        if attach {
            let _ = AttachThreadInput(this_thread, fg_thread, false);
        }
    }
}

// ---------------------------------------------------------------- çalıştırma

/// ShellExecute ile açar (Process.Start + UseShellExecute karşılığı).
pub fn shell_open(file: &str, params: &str, dir: &str) -> Result<(), String> {
    let file_w = wide(file);
    let params_w = wide(params);
    let dir_w = wide(dir);
    let verb = wide("open");
    unsafe {
        let result = ShellExecuteW(
            None,
            PCWSTR(verb.as_ptr()),
            PCWSTR(file_w.as_ptr()),
            if params.is_empty() { PCWSTR::null() } else { PCWSTR(params_w.as_ptr()) },
            if dir.is_empty() { PCWSTR::null() } else { PCWSTR(dir_w.as_ptr()) },
            SW_SHOWNORMAL,
        );
        let code = result.0 as isize;
        if code > 32 {
            Ok(())
        } else {
            Err(match code {
                2 | 3 => "Dosya veya klasör bulunamadı".to_string(),
                5 => "Erişim reddedildi".to_string(),
                _ => format!("Başlatılamadı (hata kodu {code})"),
            })
        }
    }
}

// ---------------------------------------------------------------- kısayollar

#[derive(Default, Clone, Debug)]
pub struct ShortcutInfo {
    pub target: String,
    pub arguments: String,
    pub working_dir: String,
    pub icon_location: String,
}

pub fn resolve_shortcut(lnk_path: &str) -> Option<ShortcutInfo> {
    unsafe {
        let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
        let link: IShellLinkW = CoCreateInstance(&ShellLink, None, CLSCTX_INPROC_SERVER).ok()?;
        let file: IPersistFile = link.cast().ok()?;
        let path_w = wide(lnk_path);
        file.Load(PCWSTR(path_w.as_ptr()), STGM_READ).ok()?;

        let mut buf = [0u16; 1024];
        let mut find = WIN32_FIND_DATAW::default();
        let _ = link.GetPath(&mut buf, &mut find, 0);
        let target = from_buf(&buf);

        let mut buf = [0u16; 2048];
        let _ = link.GetArguments(&mut buf);
        let arguments = from_buf(&buf);

        let mut buf = [0u16; 1024];
        let _ = link.GetWorkingDirectory(&mut buf);
        let working_dir = from_buf(&buf);

        let mut buf = [0u16; 1024];
        let mut index = 0i32;
        let _ = link.GetIconLocation(&mut buf, &mut index);
        let icon_location = from_buf(&buf);

        Some(ShortcutInfo {
            target,
            arguments,
            working_dir,
            icon_location,
        })
    }
}

// ---------------------------------------------------------------- sürüm bilgisi

/// (FileDescription, ProductName)
pub fn version_strings(path: &str) -> (Option<String>, Option<String>) {
    unsafe {
        let path_w = wide(path);
        let size = GetFileVersionInfoSizeW(PCWSTR(path_w.as_ptr()), None);
        if size == 0 {
            return (None, None);
        }
        let mut data = vec![0u8; size as usize];
        if GetFileVersionInfoW(PCWSTR(path_w.as_ptr()), None, size, data.as_mut_ptr() as *mut c_void)
            .is_err()
        {
            return (None, None);
        }

        let mut ptr: *mut c_void = null_mut();
        let mut len = 0u32;
        let query = wide("\\VarFileInfo\\Translation");
        let (lang, codepage) = if VerQueryValueW(
            data.as_ptr() as *const c_void,
            PCWSTR(query.as_ptr()),
            &mut ptr,
            &mut len,
        )
        .as_bool()
            && len >= 4
        {
            let t = *(ptr as *const [u16; 2]);
            (t[0], t[1])
        } else {
            (0x0409, 0x04B0)
        };

        let get = |name: &str| -> Option<String> {
            let sub = wide(&format!("\\StringFileInfo\\{lang:04x}{codepage:04x}\\{name}"));
            let mut p: *mut c_void = null_mut();
            let mut l = 0u32;
            if VerQueryValueW(data.as_ptr() as *const c_void, PCWSTR(sub.as_ptr()), &mut p, &mut l)
                .as_bool()
                && l > 0
            {
                let slice = std::slice::from_raw_parts(p as *const u16, l as usize);
                let s = from_buf(slice).trim().to_string();
                if !s.is_empty() {
                    return Some(s);
                }
            }
            None
        };

        (get("FileDescription"), get("ProductName"))
    }
}

// ---------------------------------------------------------------- simgeler

/// Boş yol gibi göreli adları (notepad.exe) System32 ve Windows klasöründe arar.
pub fn resolve_icon_path(raw: &str) -> Option<String> {
    let mut path = expand_env(raw.trim());
    if path.is_empty() {
        return None;
    }
    if !Path::new(&path).is_absolute() && !Path::new(&path).exists() {
        let system = expand_env("%SystemRoot%\\System32");
        let windows = expand_env("%SystemRoot%");
        let in_system = Path::new(&system).join(&path);
        let in_windows = Path::new(&windows).join(&path);
        if in_system.exists() {
            path = in_system.to_string_lossy().into_owned();
        } else if in_windows.exists() {
            path = in_windows.to_string_lossy().into_owned();
        }
    }
    Path::new(&path).exists().then_some(path)
}

/// Dosyanın simgesini PNG data URL olarak döndürür.
pub fn icon_data_url(raw_path: &str) -> Option<String> {
    let path = resolve_icon_path(raw_path)?;
    unsafe {
        let path_w = wide(&path);
        let mut info = SHFILEINFOW::default();
        let result = SHGetFileInfoW(
            PCWSTR(path_w.as_ptr()),
            FILE_FLAGS_AND_ATTRIBUTES(0),
            Some(&mut info),
            size_of::<SHFILEINFOW>() as u32,
            SHGFI_ICON | SHGFI_LARGEICON,
        );
        if result == 0 || info.hIcon.is_invalid() {
            return None;
        }
        let png = hicon_to_png(info.hIcon);
        let _ = DestroyIcon(info.hIcon);
        png.map(|bytes| format!("data:image/png;base64,{}", STANDARD.encode(bytes)))
    }
}

unsafe fn hicon_to_png(icon: HICON) -> Option<Vec<u8>> {
    let mut info = ICONINFO::default();
    GetIconInfo(icon, &mut info).ok()?;

    let result = (|| {
        if info.hbmColor.is_invalid() {
            return None;
        }
        let mut bitmap = BITMAP::default();
        if GetObjectW(
            HGDIOBJ(info.hbmColor.0),
            size_of::<BITMAP>() as i32,
            Some(&mut bitmap as *mut BITMAP as *mut c_void),
        ) == 0
        {
            return None;
        }
        let (w, h) = (bitmap.bmWidth, bitmap.bmHeight);
        if w <= 0 || h <= 0 {
            return None;
        }

        let make_header = || {
            let mut bi = BITMAPINFO::default();
            bi.bmiHeader.biSize = size_of::<BITMAPINFOHEADER>() as u32;
            bi.bmiHeader.biWidth = w;
            bi.bmiHeader.biHeight = -h; // yukarıdan aşağıya
            bi.bmiHeader.biPlanes = 1;
            bi.bmiHeader.biBitCount = 32;
            bi.bmiHeader.biCompression = BI_RGB.0;
            bi
        };

        let hdc = GetDC(None);
        let mut color = vec![0u8; (w * h * 4) as usize];
        let mut bi = make_header();
        let color_ok = GetDIBits(
            hdc,
            info.hbmColor,
            0,
            h as u32,
            Some(color.as_mut_ptr() as *mut c_void),
            &mut bi,
            DIB_RGB_COLORS,
        );

        let mut mask = vec![0u8; (w * h * 4) as usize];
        let mask_ok = if info.hbmMask.is_invalid() {
            0
        } else {
            let mut bi = make_header();
            GetDIBits(
                hdc,
                info.hbmMask,
                0,
                h as u32,
                Some(mask.as_mut_ptr() as *mut c_void),
                &mut bi,
                DIB_RGB_COLORS,
            )
        };
        ReleaseDC(None, hdc);
        if color_ok == 0 {
            return None;
        }

        // Eski tarz simgelerde alfa kanalı boştur; bu durumda maskeyi kullan.
        let has_alpha = color.chunks_exact(4).any(|p| p[3] != 0);
        let mut rgba = Vec::with_capacity(color.len());
        for (i, p) in color.chunks_exact(4).enumerate() {
            let alpha = if has_alpha || mask_ok == 0 {
                if has_alpha { p[3] } else { 255 }
            } else if mask[i * 4] == 0 {
                255
            } else {
                0
            };
            rgba.extend_from_slice(&[p[2], p[1], p[0], alpha]);
        }

        let mut out = Vec::new();
        {
            let mut encoder = png::Encoder::new(&mut out, w as u32, h as u32);
            encoder.set_color(png::ColorType::Rgba);
            encoder.set_depth(png::BitDepth::Eight);
            let mut writer = encoder.write_header().ok()?;
            writer.write_image_data(&rgba).ok()?;
        }
        Some(out)
    })();

    let _ = DeleteObject(HGDIOBJ(info.hbmColor.0));
    if !info.hbmMask.is_invalid() {
        let _ = DeleteObject(HGDIOBJ(info.hbmMask.0));
    }
    result
}
