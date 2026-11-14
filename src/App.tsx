import { useEffect, useState } from "react";
import { Camera, Plus, Rocket, Settings } from "lucide-react";
import { api, onBundleResult, onBundleStarted, setWindowTheme } from "./api";
import { AppPickerModal } from "./AppPickerModal";
import { BundleGlyph } from "./BundleGlyph";
import { BundleView } from "./BundleView";
import { SettingsView } from "./SettingsView";
import type { AppBundle, BundleEvent } from "./types";
import { newBundle, newItem } from "./types";
import {
  Alert, Badge, Button, Card, EmptyState, Sidebar, Spinner, ToastProvider, useToast,
  type SidebarEntry,
} from "./ui";
import { ConfigProvider, useConfig } from "./useConfig";
import { useTheme } from "./useTheme";

export default function App() {
  return (
    <ToastProvider>
      <ConfigProvider fallback={<div className="app-boot"><Spinner label="Demet yükleniyor" /></div>}>
        <Shell />
      </ConfigProvider>
    </ToastProvider>
  );
}

const NEW_BUNDLE = "__new";
const SNAPSHOT = "__snapshot";
const SETTINGS = "settings";

function summarize(e: BundleEvent): { tone: "success" | "danger" | "info"; title: string; text: string } {
  if (e.kind === "close") {
    return {
      tone: e.errors.length ? "danger" : "info",
      title: `“${e.bundleName}” kapatıldı`,
      text: e.errors.length ? e.errors[0] : `${e.closedCount} uygulama penceresi kapatıldı.`,
    };
  }
  const parts = [`${e.launchedCount} öğe başlatıldı`];
  if (e.focusedOrSkippedCount > 0) parts.push(`${e.focusedOrSkippedCount} açık pencere öne getirildi`);
  if (e.errors.length > 0) parts.push(`${e.errors.length} hata: ${e.errors[0]}`);
  return {
    tone: e.errors.length ? "danger" : "success",
    title: `“${e.bundleName}” başlatıldı`,
    text: parts.join(", "),
  };
}

function Shell() {
  const { mode, setMode } = useTheme();
  const toast = useToast();
  const { config, warnings, update } = useConfig();
  const [view, setView] = useState<string>(() => config.bundles[0]?.id ?? SETTINGS);
  const [snapshotOpen, setSnapshotOpen] = useState(false);

  useEffect(() => { void api.appReady(); }, []);
  useEffect(() => { void setWindowTheme(mode); }, [mode]);

  useEffect(() => {
    let offStarted: (() => void) | undefined;
    let offResult: (() => void) | undefined;
    let disposed = false;
    void onBundleStarted((e) => toast({ tone: "info", title: `“${e.bundleName}” başlatılıyor…` })).then((u) => {
      if (disposed) u(); else offStarted = u;
    });
    void onBundleResult((e) => toast(summarize(e))).then((u) => {
      if (disposed) u(); else offResult = u;
    });
    return () => { disposed = true; offStarted?.(); offResult?.(); };
  }, [toast]);

  const selected: AppBundle | undefined = config.bundles.find((b) => b.id === view);
  // Seçili demet silinmişse ya da yoksa güvenli bir görünüme dön.
  useEffect(() => {
    if (view !== SETTINGS && !selected) setView(config.bundles[0]?.id ?? SETTINGS);
  }, [view, selected, config.bundles]);

  const createBundle = () => {
    const number = config.bundles.length + 1;
    const bundle = newBundle({
      name: `Yeni Demet ${number}`,
      description: "Bu demet için açıklama...",
      hotkey: number <= 9 ? `Ctrl+Alt+Shift+${number}` : "",
    });
    update((c) => { c.bundles.push(bundle); });
    setView(bundle.id);
    toast({ tone: "success", title: "Demet oluşturuldu", text: bundle.name });
  };

  const items: SidebarEntry[] = [
    { section: "Demetler" },
    ...config.bundles.map((b) => ({
      value: b.id,
      label: b.name,
      icon: <BundleGlyph value={b.iconEmoji} size={18} />,
      badge: <Badge tone="neutral">{b.items.filter((i) => i.enabled).length}</Badge>,
    })),
    { value: NEW_BUNDLE, label: "Yeni demet", icon: <Plus size={18} /> },
    { value: SNAPSHOT, label: "Açık uygulamalardan", icon: <Camera size={18} /> },
    { section: "Uygulama" },
    { value: SETTINGS, label: "Ayarlar", icon: <Settings size={18} /> },
  ];

  const onSelect = (value: string) => {
    if (value === NEW_BUNDLE) createBundle();
    else if (value === SNAPSHOT) setSnapshotOpen(true);
    else setView(value);
  };

  return (
    <div className="ui-page">
      <div className="ui-glow" />
      <div className="ui-shell">
        <aside className="ui-shell-side">
          <div className="app-brand">
            <span className="app-brand-mark" aria-hidden="true"><Rocket size={18} /></span>
            <div>
              <div className="app-brand-name">Demet</div>
              <div className="ui-muted">Uygulama demeti başlatıcı</div>
            </div>
          </div>
          <Sidebar items={items} active={view} onSelect={onSelect} />
        </aside>

        <main className="ui-shell-main">
          {warnings.length > 0 && (
            <div className="app-warnings">
              <Alert tone="danger" title="Bazı kısayollar kaydedilemedi">
                {warnings.join(" ")}
              </Alert>
            </div>
          )}

          {view === SETTINGS ? (
            <SettingsView mode={mode} onModeChange={setMode} />
          ) : selected ? (
            <BundleView key={selected.id} bundle={selected} onDeleted={() => setView(config.bundles.find((b) => b.id !== selected.id)?.id ?? SETTINGS)} />
          ) : (
            <Card>
              <EmptyState
                icon={<Rocket size={26} />}
                title="Henüz demet yok"
                description="Demet, tek kısayolla birlikte açılan uygulama, klasör ve web adreslerinin listesidir."
                action={<Button variant="filled" icon={<Plus size={18} />} onClick={createBundle}>İlk demetini oluştur</Button>}
              />
            </Card>
          )}
        </main>
      </div>

      <AppPickerModal
        mode="snapshot"
        open={snapshotOpen}
        onClose={() => setSnapshotOpen(false)}
        onConfirm={(apps, meta) => {
          const bundle = newBundle({
            name: meta.name,
            description: `${new Date().toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })} tarihinde açık uygulamalardan oluşturuldu`,
            iconEmoji: meta.icon,
            hotkey: meta.hotkey,
            items: apps.map((app) => newItem({
              name: app.name,
              target: app.executablePath,
              arguments: app.arguments,
              workingDirectory: app.workingDirectory,
            })),
          });
          update((c) => { c.bundles.push(bundle); });
          setSnapshotOpen(false);
          setView(bundle.id);
          toast({ tone: "success", title: "Demet oluşturuldu", text: `${bundle.name} · ${bundle.items.length} uygulama` });
        }}
      />
    </div>
  );
}
