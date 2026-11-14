import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { AppWindow, RefreshCw } from "lucide-react";
import { api } from "./api";
import { AppModal } from "./AppModal";
import { AppTile } from "./AppIcon";
import { HotkeyField } from "./HotkeyField";
import { IconField } from "./IconField";
import type { DiscoveredApp } from "./types";
import { Badge, Button, Checkbox, Field, Input, SearchField, Spinner } from "./ui";

export type PickerMode = "snapshot" | "addOpen" | "pickInstalled";

export interface SnapshotMeta {
  name: string;
  icon: string;
  hotkey: string;
}

const COPY: Record<PickerMode, { title: string; subtitle: string; confirm: string }> = {
  snapshot: {
    title: "Açık uygulamalardan demet oluştur",
    subtitle: "Şu an açık olan uygulamalar listelendi. Demete dahil etmek istediklerini işaretle.",
    confirm: "Demeti oluştur",
  },
  addOpen: {
    title: "Açık uygulamalardan ekle",
    subtitle: "Şu an açık olan uygulamalardan seçtiklerin mevcut demete eklenecek.",
    confirm: "Seçilenleri ekle",
  },
  pickInstalled: {
    title: "Başlat menüsünden seç",
    subtitle: "Yüklü uygulamalardan eklemek istediklerini işaretle. Birden fazla seçebilirsin.",
    confirm: "Seçilenleri ekle",
  },
};

const PickRow = memo(function PickRow({
  app, checked, onToggle, onPick,
}: {
  app: DiscoveredApp;
  checked: boolean;
  onToggle: (app: DiscoveredApp, on: boolean) => void;
  /** Çift tıklamayla doğrudan seçim (yalnızca tek seçimli kipte verilir). */
  onPick?: (app: DiscoveredApp) => void;
}) {
  return (
    <div role="listitem" className="app-pick-row" onDoubleClick={onPick ? () => onPick(app) : undefined}>
      <Checkbox
        aria-label={app.name}
        checked={checked}
        onCheckedChange={(on) => onToggle(app, on)}
        label={
          <>
            <AppTile path={app.iconSource || app.executablePath} fallback={<AppWindow size={18} />} />
            <span className="app-pick-text">
              <span className="app-item-name">{app.name}</span>
              <span className="ui-muted app-item-detail">
                {app.windowTitle ? `${app.windowTitle} — ` : ""}{app.executablePath}
              </span>
            </span>
          </>
        }
      />
    </div>
  );
});

const keyOf = (app: DiscoveredApp) => `${app.executablePath}|${app.name}`;
const DEFAULT_META: SnapshotMeta = { name: "", icon: "thunderbolt", hotkey: "" };

export function AppPickerModal({
  mode, open, multiple = true, confirmLabel, onClose, onConfirm,
}: {
  mode: PickerMode;
  open: boolean;
  /** false ise yalnızca tek uygulama seçilir (var olan bir öğeyi düzenlerken). */
  multiple?: boolean;
  confirmLabel?: string;
  onClose: () => void;
  onConfirm: (apps: DiscoveredApp[], meta: SnapshotMeta) => void;
}) {
  const copy = COPY[mode];
  const [apps, setApps] = useState<DiscoveredApp[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [meta, setMeta] = useState<SnapshotMeta>(DEFAULT_META);
  const [error, setError] = useState("");

  const load = useCallback(async (forceRefresh: boolean) => {
    setLoading(true);
    try {
      const list = mode === "pickInstalled"
        ? await api.getInstalledApps(forceRefresh)
        : await api.getOpenApps();
      setApps(list);
      // Açık uygulamalar varsayılan olarak seçili gelir (eski davranış).
      setSelected(mode === "pickInstalled" ? new Set() : new Set(list.map(keyOf)));
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setError("");
    setMeta(DEFAULT_META);
    void load(false);
  }, [open, load]);

  // Çok uzun listelerde yazmak donmasın: arama sonucu bir adım geriden gelebilir.
  const deferredQuery = useDeferredValue(query);
  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLocaleLowerCase("tr");
    if (!q) return apps;
    return apps.filter((a) =>
      [a.name, a.windowTitle, a.executablePath].some((t) => t.toLocaleLowerCase("tr").includes(q)));
  }, [apps, deferredQuery]);

  const toggle = useCallback((app: DiscoveredApp, on: boolean) => {
    setError("");
    setSelected((prev) => {
      const next = multiple ? new Set(prev) : new Set<string>();
      if (on) next.add(keyOf(app)); else next.delete(keyOf(app));
      return next;
    });
  }, [multiple]);

  const confirm = (override?: DiscoveredApp[]) => {
    const chosen = override ?? apps.filter((a) => selected.has(keyOf(a)));
    if (chosen.length === 0) {
      setError("Lütfen en az bir uygulama seçin.");
      return;
    }
    if (mode === "snapshot" && !meta.name.trim()) {
      setError("Lütfen yeni demet için bir ad girin.");
      return;
    }
    onConfirm(chosen, { ...meta, name: meta.name.trim() });
  };

  const latestConfirm = useRef(confirm);
  latestConfirm.current = confirm;
  const pickOne = useCallback((app: DiscoveredApp) => latestConfirm.current([app]), []);

  // Açılınca arama kutusuna odaklan.
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(
      () => document.querySelector<HTMLInputElement>('.ui-modal input[aria-label="Uygulama ara"]')?.focus(),
      80,
    );
    return () => window.clearTimeout(timer);
  }, [open]);

  const selectedCount = selected.size;
  const confirmText = confirmLabel ?? copy.confirm;

  return (
    <AppModal
      open={open}
      onClose={onClose}
      title={copy.title}
      footer={
        <>
          <Button onClick={onClose}>Vazgeç</Button>
          <Button variant="filled" onClick={() => confirm()}>
            {multiple && selectedCount > 0 ? `${confirmText} (${selectedCount})` : confirmText}
          </Button>
        </>
      }
    >
      <div className="ui-stack app-modal-wide">
        <p className="ui-muted">{copy.subtitle}</p>

        {mode === "snapshot" && (
          <div className="ui-row app-meta-row">
            <Field label="İkon">
              {() => <IconField label="Demet ikonu" value={meta.icon} onChange={(icon) => setMeta({ ...meta, icon })} />}
            </Field>
            <div className="ui-grow">
              <Field label="Demet adı">
                {(id) => <Input id={id} value={meta.name} placeholder="Örn: Çalışma masası" onValueChange={(name) => { setMeta({ ...meta, name }); setError(""); }} />}
              </Field>
            </div>
            <div className="ui-w-md">
              <Field label="Kısayol (isteğe bağlı)">
                {() => <HotkeyField label="Demet" value={meta.hotkey} onChange={(hotkey) => setMeta({ ...meta, hotkey })} />}
              </Field>
            </div>
          </div>
        )}

        <div className="ui-row app-pick-toolbar">
          <div className="ui-grow"><SearchField aria-label="Uygulama ara" placeholder="Ara…" value={query} onValueChange={setQuery} /></div>
          {/* Sağ sütun, yukarıdaki kısayol alanıyla aynı genişlikte: iki satırın kenarları hizalı kalır. */}
          <div className="ui-w-md app-pick-actions">
            {multiple && (
              <>
                <Button onClick={() => setSelected(new Set(filtered.map(keyOf)))}>Tümünü seç</Button>
                <Button onClick={() => setSelected(new Set())}>Temizle</Button>
              </>
            )}
            <Button icon={<RefreshCw size={16} />} aria-label="Listeyi yenile" onClick={() => void load(true)} />
          </div>
        </div>

        <div className="app-pick-list" role="list">
          {loading && <div className="app-pick-status"><Spinner /> Taranıyor…</div>}
          {!loading && filtered.length === 0 && <div className="app-pick-status">Eşleşen uygulama yok.</div>}
          {!loading && filtered.map((app) => (
            <PickRow
              key={keyOf(app)}
              app={app}
              checked={selected.has(keyOf(app))}
              onToggle={toggle}
              onPick={multiple ? undefined : pickOne}
            />
          ))}
        </div>

        <div className="ui-row is-between">
          <span className="ui-muted">{loading ? "Taranıyor…" : `${filtered.length} uygulama listeleniyor`}</span>
          {multiple && <Badge tone={selectedCount > 0 ? "accent" : "neutral"}>{selectedCount} seçili</Badge>}
        </div>
        {error && <p className="app-error" role="alert">{error}</p>}
      </div>
    </AppModal>
  );
}
