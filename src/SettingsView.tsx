import { useEffect, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { api, getAppVersion } from "./api";
import { HotkeyField } from "./HotkeyField";
import type { MouseTrigger } from "./types";
import { Button, Card, Field, Progress, SegmentedControl, Select, Switch, useToast } from "./ui";
import { useConfig } from "./useConfig";
import type { Mode } from "./useTheme";
import { updateLabel, type UpdateState } from "./updater";

const MOUSE_OPTIONS: { value: MouseTrigger; label: string; description?: string }[] = [
  { value: "CtrlMiddleClick", label: "Ctrl + Orta fare tuşu", description: "Önerilen" },
  { value: "AltMiddleClick", label: "Alt + Orta fare tuşu" },
  { value: "CtrlShiftRightClick", label: "Ctrl + Shift + Sağ tık" },
  { value: "CtrlXButton1", label: "Ctrl + Fare yan tuşu" },
  { value: "Disabled", label: "Kapalı", description: "Yalnızca klavye" },
];

interface UpdaterApi {
  state: UpdateState;
  checkNow: () => Promise<void>;
  install: () => Promise<void>;
}

export function SettingsView({
  mode, onModeChange, updater,
}: { mode: Mode; onModeChange: (mode: Mode) => void; updater: UpdaterApi }) {
  const { config, update } = useConfig();
  const toast = useToast();
  const [startup, setStartup] = useState(false);
  const [version, setVersion] = useState("");

  useEffect(() => {
    void api.isStartupEnabled().then(setStartup);
    void getAppVersion().then(setVersion);
  }, []);

  const { state } = updater;
  const checking = state.kind === "checking" || state.kind === "downloading";
  const statusText = updateLabel(state) ?? "Güncellemeler GitHub üzerinden indirilir ve imzası doğrulanarak kurulur.";
  const versionText = version ? (/^\d/.test(version) ? ` v${version}` : ` ${version}`) : "";

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

      <Card title="Güncellemeler">
        <div className="ui-setting">
          <div className="ui-setting-label">
            Demet{versionText}
            <small>{statusText}</small>
          </div>
          {state.kind === "available" ? (
            <Button variant="filled" icon={<Download size={18} />} onClick={() => void updater.install()}>
              {state.version} sürümünü kur
            </Button>
          ) : (
            <Button icon={<RefreshCw size={18} />} disabled={checking} onClick={() => void updater.checkNow()}>
              Güncellemeleri denetle
            </Button>
          )}
        </div>
        {state.kind === "downloading" && (
          <Progress value={state.percent ?? 0} label="Güncelleme indiriliyor" />
        )}
      </Card>
    </div>
  );
}
