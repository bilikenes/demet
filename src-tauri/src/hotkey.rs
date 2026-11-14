//! "Ctrl+Alt+Space" biçimindeki kısayol metnini Win32 değiştirici + sanal tuş koduna çevirir.

pub const MOD_ALT: u32 = 0x0001;
pub const MOD_CONTROL: u32 = 0x0002;
pub const MOD_SHIFT: u32 = 0x0004;
pub const MOD_WIN: u32 = 0x0008;

pub fn parse(text: &str) -> Option<(u32, u32)> {
    let mut modifiers = 0u32;
    let mut key: Option<u32> = None;

    for token in text.split('+').map(str::trim).filter(|t| !t.is_empty()) {
        match token.to_ascii_lowercase().as_str() {
            "ctrl" | "control" => modifiers |= MOD_CONTROL,
            "alt" => modifiers |= MOD_ALT,
            "shift" => modifiers |= MOD_SHIFT,
            "win" | "windows" => modifiers |= MOD_WIN,
            _ => key = vk_from_name(token),
        }
    }

    key.map(|vk| (modifiers, vk))
}

fn vk_from_name(token: &str) -> Option<u32> {
    let lower = token.to_ascii_lowercase();
    let mut chars = lower.chars();

    if let (Some(c), None) = (chars.next(), chars.clone().next()) {
        if c.is_ascii_digit() {
            return Some(c as u32);
        }
        if c.is_ascii_lowercase() {
            return Some(c.to_ascii_uppercase() as u32);
        }
    }

    // F1..F24
    if let Some(rest) = lower.strip_prefix('f') {
        if let Ok(n) = rest.parse::<u32>() {
            if (1..=24).contains(&n) {
                return Some(0x6F + n);
            }
        }
    }

    // Sayısal tuş takımı
    if let Some(rest) = lower.strip_prefix("numpad") {
        if let Ok(n) = rest.parse::<u32>() {
            if n <= 9 {
                return Some(0x60 + n);
            }
        }
    }

    Some(match lower.as_str() {
        "space" => 0x20,
        "tilde" | "oemtilde" | "oem3" => 0xC0,
        "enter" | "return" => 0x0D,
        "tab" => 0x09,
        "escape" | "esc" => 0x1B,
        "back" | "backspace" => 0x08,
        "delete" | "del" => 0x2E,
        "insert" | "ins" => 0x2D,
        "home" => 0x24,
        "end" => 0x23,
        "pageup" | "prior" => 0x21,
        "pagedown" | "next" => 0x22,
        "up" => 0x26,
        "down" => 0x28,
        "left" => 0x25,
        "right" => 0x27,
        "oemminus" | "minus" => 0xBD,
        "oemplus" | "plus" => 0xBB,
        "oemcomma" | "comma" => 0xBC,
        "oemperiod" | "period" => 0xBE,
        "oem1" | "oemsemicolon" | "semicolon" => 0xBA,
        "oem2" | "oemquestion" | "slash" => 0xBF,
        "oem4" | "oemopenbrackets" | "bracketleft" => 0xDB,
        "oem5" | "oempipe" | "backslash" => 0xDC,
        "oem6" | "oemclosebrackets" | "bracketright" => 0xDD,
        "oem7" | "oemquotes" | "quote" => 0xDE,
        _ => return None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_common_hotkeys() {
        assert_eq!(parse("Ctrl+Alt+Space"), Some((MOD_CONTROL | MOD_ALT, 0x20)));
        assert_eq!(parse("Ctrl+Alt+1"), Some((MOD_CONTROL | MOD_ALT, 0x31)));
        assert_eq!(parse("Win+Shift+K"), Some((MOD_WIN | MOD_SHIFT, 0x4B)));
        assert_eq!(parse("F5"), Some((0, 0x74)));
        assert_eq!(parse("Ctrl+Tilde"), Some((MOD_CONTROL, 0xC0)));
        assert_eq!(parse("Ctrl+"), None);
        assert_eq!(parse(""), None);
    }
}
