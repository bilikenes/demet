import { useEffect, useState } from "react";
import { api } from "./api";
import { HotkeyField } from "./HotkeyField";
import type { MouseTrigger } from "./types";
import { Card, Field, SegmentedControl, Select, Switch, useToast } from "./ui";
import { useConfig } from "./useConfig";
import type { Mode } from "./useTheme";

const MOUSE_OPTIONS: { value: MouseTrigger; label: string; description?: string }[] = [
  { value: "CtrlMiddleClick", label: "Ctrl + Orta fare tuşu", description: "Önerilen" },
  { value: "AltMiddleClick", label: "Alt + Orta fare tuşu" },
  { value: "CtrlShiftRightClick", label: "Ctrl + Shift + Sağ tık" },
  { value: "CtrlXButton1", label: "Ctrl + Fare yan tuşu" },
  { value: "Disabled", label: "Kapalı", description: "Yalnızca klavye" },
];

export function SettingsView({ mode, onModeChange }: { mode: Mode; onModeChange: (mode: Mode) => void }) {
  const { config, update } = useConfig();
  const toast = useToast();
  const [startup, setStartup] = useState(false);

  useEffect(() => {
    void api.isStartupEnabled().then(setStartup);
  }, []);

  const toggleStartup = async (enable: boolean) => {
    const ok = await api.setStartupEnabled(enable);
    if (ok) {
      setStartup(enable);
      toast({
        tone: "success",
        title: enable ? "Windows ile başlayacak" : "Otomatik başlatma kapatıldı",
        text: enable ? "Demet açılışta sistem tepsisinde çalışır." : undefined,
      });
    } else {
      toast({ tone: "danger", title: "Başlangıç kaydı güncellenemedi" });
    }
  };

  return (
    <div className="ui-stack is-loose">
      <div>
        <h1 className="ui-title">Ayarlar</h1>
        <p className="ui-muted">Görünüm, hızlı menüyü açan tetikleyiciler ve uygulama davranışı.</p>
      </div>

      <Card title="Görünüm">
        <div className="ui-setting">
          <div className="ui-setting-label">
            Tema
            <small>Uygulamanın açık ya da koyu görünmesi.</small>
          </div>
          <SegmentedControl
            aria-label="Tema"
            value={mode}
            onValueChange={(value) => onModeChange(value as Mode)}
            items={[{ value: "light", label: "Açık" }, { value: "dark", label: "Koyu" }]}
          />
        </div>
      </Card>

      <Card title="Hızlı menü" description="Her yerden açılan, demetleri seçip başlattığın küçük pencere.">
        <div className="ui-stack">
          <Field label="Klavye kısayolu" hint="Kutuya tıkla ve tuşlara bas. Kapatmak için Backspace.">
            {() => (
              <div className="ui-w-md">
                <HotkeyField
                  label="Hızlı menü kısayolu"
                  clearable={false}
                  value={config.overlayHotkey}
                  onChange={(overlayHotkey) => update((c) => { c.overlayHotkey = overlayHotkey; })}
                />
              </div>
            )}
          </Field>
          <Field label="Fare kombinasyonu">
            {(id) => (
              <div className="ui-w-md">
                <Select
                  id={id}
                  value={config.mouseTrigger}
                  options={MOUSE_OPTIONS}
                  onValueChange={(value) => update((c) => { c.mouseTrigger = value as MouseTrigger; })}
                />
              </div>
            )}
          </Field>
        </div>
      </Card>

      <Card title="Uygulama">
        <div>
          <div className="ui-setting">
            <div className="ui-setting-label">
              Windows ile başlat
              <small>Bilgisayar açıldığında Demet sistem tepsisinde başlar.</small>
            </div>
            <Switch aria-label="Windows ile başlat" checked={startup} onCheckedChange={(on) => void toggleStartup(on)} />
          </div>
          <div className="ui-setting">
            <div className="ui-setting-label">
              Pencereyi kapatınca tepside çalışmaya devam et
              <small>Kapalıyken pencereyi kapatmak uygulamadan çıkar ve kısayollar durur.</small>
            </div>
            <Switch
              aria-label="Kapatınca tepside çalışmaya devam et"
              checked={config.minimizeToTrayOnClose}
              onCheckedChange={(on) => update((c) => { c.minimizeToTrayOnClose = on; })}
            />
          </div>
        </div>
      </Card>
    </div>
  );
}
