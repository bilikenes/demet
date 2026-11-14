// Klavye olayını "Ctrl+Alt+Space" biçimindeki kısayol metnine çevirir.
// Adlandırma Rust tarafındaki `hotkey::parse` ve eski WPF sürümüyle uyumludur.

const NAMED: Record<string, string> = {
  Space: "Space",
  Backquote: "Tilde",
  Enter: "Enter",
  NumpadEnter: "Enter",
  Tab: "Tab",
  Insert: "Insert",
  Home: "Home",
  End: "End",
  PageUp: "PageUp",
  PageDown: "PageDown",
  ArrowUp: "Up",
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",
  Minus: "OemMinus",
  Equal: "OemPlus",
  Comma: "OemComma",
  Period: "OemPeriod",
  Semicolon: "Oem1",
  Slash: "Oem2",
  BracketLeft: "Oem4",
  Backslash: "Oem5",
  BracketRight: "Oem6",
  Quote: "Oem7",
};

const MODIFIER_CODES = new Set([
  "ControlLeft", "ControlRight", "AltLeft", "AltRight",
  "ShiftLeft", "ShiftRight", "MetaLeft", "MetaRight",
]);

function keyName(code: string): string | null {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(code)) return code;
  if (/^Numpad[0-9]$/.test(code)) return `NumPad${code.slice(6)}`;
  return NAMED[code] ?? null;
}

export function isClearKey(e: KeyboardEvent | React.KeyboardEvent): boolean {
  return e.code === "Backspace" || e.code === "Delete" || e.code === "Escape";
}

/** Geçerli bir kombinasyon değilse boş metin döner. */
export function formatHotkey(e: KeyboardEvent | React.KeyboardEvent): string {
  if (MODIFIER_CODES.has(e.code)) return "";
  const name = keyName(e.code);
  if (!name) return "";

  const parts: string[] = [];
  if (e.ctrlKey) parts.push("Ctrl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  if (e.metaKey) parts.push("Win");

  // F tuşları dışındakiler için en az bir değiştirici gerekir.
  const isFunctionKey = /^F\d+$/.test(name);
  if (parts.length === 0 && !isFunctionKey) return "";

  parts.push(name);
  return parts.join("+");
}
