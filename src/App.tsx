import { useEffect, useState } from "react";
import { AppWindow, Plus, Settings } from "lucide-react";
import { api, inTauri, onBundleResult, onBundleStarted, setWindowTheme } from "./api";
import { AppPickerModal } from "./AppPickerModal";
import { AnimatedBackground } from "./background/AnimatedBackground";
import { BundleGlyph } from "./BundleGlyph";
import { BundleView } from "./BundleView";
import { SidebarMonkey } from "./SidebarMonkey";
import { TitleBar } from "./TitleBar";
import { SettingsView } from "./SettingsView";
import { WelcomeView } from "./WelcomeView";
import type { AppBundle, BundleEvent, BundleItem } from "./types";
import { newBundle, newItem } from "./types";
import {
  Alert, Badge, Button, Progress, Sidebar, Spinner, ToastProvider, useToast,
  type SidebarEntry,
} from "./ui";
import { ConfigProvider, useConfig } from "./useConfig";
import { useUpdater } from "./updater";
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
/** Hiç demet yokken gösterilen karşılama ekranı. */
const WELCOME = "__welcome";

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
  const [view, setView] = useState<string>(() => config.bundles[0]?.id ?? WELCOME);
  const [installedOpen, setInstalledOpen] = useState(false);
  const [snapshotOpen, setSnapshotOpen] = useState(false);
  const updater = useUpdater(inTauri);
  const [updateDismissed, setUpdateDismissed] = useState(false);
  const updateState = updater.state;
  const updateReady = updateState.kind === "available" || updateState.kind === "downloading";

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
    if (view !== SETTINGS && !selected) setView(config.bundles[0]?.id ?? WELCOME);
  }, [view, selected, config.bundles]);

  const createBundle = (items: BundleItem[] = []) => {
    const number = config.bundles.length + 1;
    const bundle = newBundle({
      name: `Yeni Demet ${number}`,
      description: "Bu demet için açıklama...",
      hotkey: number <= 9 ? `Ctrl+Alt+Shift+${number}` : "",
      items,
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
    { value: SNAPSHOT, label: "Açık uygulamalardan", icon: <AppWindow size={18} /> },
    { section: "Uygulama" },
    {
      value: SETTINGS,
      label: "Ayarlar",
      icon: <Settings size={18} />,
      badge: updateReady ? <Badge>Güncelleme</Badge> : undefined,
    },
  ];

  const onSelect = (value: string) => {
    if (value === NEW_BUNDLE) createBundle();
    else if (value === SNAPSHOT) setSnapshotOpen(true);
    else setView(value);
  };

  // Hiç demet yokken yan menü gizlenir; karşılama ekranı tek başına ortalanır.
  const solo = view === WELCOME && config.bundles.length === 0;

  return (
    <div className={`ui-page app-root${inTauri ? " has-titlebar" : ""}`}>
      {inTauri && <TitleBar />}
      <div className="app-stage">
        <AnimatedBackground mode={mode} />
        <div className="app-scroll">
          <div className={`ui-shell${solo ? " is-solo" : ""}`}>
            {!solo && <aside className="ui-shell-side">
              <SidebarMonkey mode={mode} />
              <Sidebar items={items} active={view} onSelect={onSelect} />
            </aside>}

            <main className="ui-shell-main">
              {warnings.length > 0 && (
                <div className="app-warnings">
                  <Alert tone="danger" title="Bazı kısayollar kaydedilemedi">
                    {warnings.join(" ")}
                  </Alert>
                </div>
              )}

              {updateReady && !(updateDismissed && updateState.kind === "available") && (
                <div className="app-warnings">
                  <Alert
                    tone="accent"
                    title={updateState.kind === "available" ? `Yeni sürüm hazır: ${updateState.version}` : "Güncelleme indiriliyor"}
                    onClose={updateState.kind === "available" ? () => setUpdateDismissed(true) : undefined}
                    action={
                      updateState.kind === "available" ? (
                        <Button onClick={() => void updater.install()}>Şimdi güncelle</Button>
                      ) : undefined
                    }
                  >
                    {updateState.kind === "downloading" ? (
                      <Progress value={updateState.percent ?? 0} label="Güncelleme indiriliyor" />
                    ) : (
                      "Kurulumdan sonra Demet kendiliğinden yeniden açılır."
                    )}
                  </Alert>
                </div>
              )}

              {view === SETTINGS ? (
                <SettingsView mode={mode} onModeChange={setMode} updater={updater} />
              ) : selected ? (
                <BundleView key={selected.id} bundle={selected} onDeleted={() => setView(config.bundles.find((b) => b.id !== selected.id)?.id ?? WELCOME)} />
              ) : (
                <WelcomeView
                  onSnapshot={() => setSnapshotOpen(true)}
                  onCreateEmpty={() => createBundle()}
                  onPickInstalled={() => setInstalledOpen(true)}
                />
              )}
            </main>
          </div>
        </div>
      </div>

      <AppPickerModal
        mode="pickInstalled"
        open={installedOpen}
        onClose={() => setInstalledOpen(false)}
        onConfirm={(apps) => {
          setInstalledOpen(false);
          createBundle(apps.map((app) => newItem({
            name: app.name,
            target: app.executablePath,
            arguments: app.arguments,
            workingDirectory: app.workingDirectory,
          })));
        }}
      />

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
