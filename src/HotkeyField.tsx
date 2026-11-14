import { Keyboard, X } from "lucide-react";
import { api } from "./api";
import { formatHotkey, isClearKey } from "./hotkey";
import { Button, Input } from "./ui";

/** Ctrl+Alt (= AltGr) tek başına kullanılırsa #, @, € gibi karakterleri engeller. */
function blocksAltGr(hotkey: string): boolean {
  const parts = hotkey.split("+");
  const key = parts[parts.length - 1] ?? "";
  return parts.includes("Ctrl") && parts.includes("Alt")
    && !parts.includes("Shift") && !parts.includes("Win") && !/^F\d+$/.test(key);
}

/**
 * "Tıkla ve bas" kısayol alanı. Odaktayken global kısayollar durdurulur; böylece
 * atanmış bir kombinasyona basılsa bile olay bu alana ulaşır.
 */
export function HotkeyField({
  value, onChange, label, placeholder = "Tıkla ve tuşlara bas", clearable = true,
}: {
  value: string;
  onChange: (next: string) => void;
  label: string;
  placeholder?: string;
  /** false ise yanında "kaldır" düğmesi çıkmaz (Backspace yine temizler). */
  clearable?: boolean;
}) {
  return (
    <div className="ui-stack is-tight">
    <div className="ui-row is-tight">
      <div className="ui-grow">
        <Input
          readOnly
          aria-label={label}
          icon={<Keyboard size={16} />}
          value={value}
          placeholder={placeholder}
          onFocus={() => void api.setTriggersPaused(true)}
          onBlur={() => void api.setTriggersPaused(false)}
          onKeyDown={(e) => {
            if (e.code === "Tab") return;
            e.preventDefault();
            if (isClearKey(e)) {
              onChange("");
              return;
            }
            const next = formatHotkey(e);
            if (next) onChange(next);
          }}
        />
      </div>
      {clearable && value && (
        <Button icon={<X size={16} />} aria-label={`${label} kısayolunu kaldır`} onClick={() => onChange("")} />
      )}
    </div>
    {blocksAltGr(value) && (
      <p className="app-warn" role="status">
        Ctrl+Alt, AltGr ile yazılan karakterleri (#, @, € …) engeller. Shift ekle ya da başka bir kombinasyon seç.
      </p>
    )}
    </div>
  );
}
