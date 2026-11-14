import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LayoutDashboard, Play, Power } from "lucide-react";
import { api, onOverlayShow } from "./api";
import { BundleGlyph } from "./BundleGlyph";
import type { AppBundle } from "./types";
import { Button, EmptyState, Kbd, SearchField } from "./ui";
import { useTheme } from "./useTheme";

/** İmlecin yanında açılan hızlı demet seçici (ayrı bir Tauri penceresi). */
export function Overlay() {
  useTheme();
  const [bundles, setBundles] = useState<AppBundle[]>([]);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    const config = await api.getConfig();
    setBundles(config.bundles);
    setQuery("");
    setIndex(0);
    window.setTimeout(() => rootRef.current?.querySelector("input")?.focus(), 30);
  }, []);

  useEffect(() => {
    void refresh();
    let unlisten: (() => void) | undefined;
    void onOverlayShow(() => void refresh()).then((u) => { unlisten = u; });
    return () => unlisten?.();
  }, [refresh]);

  const rows = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr");
    if (!q) return bundles;
    return bundles.filter((b) =>
      b.name.toLocaleLowerCase("tr").includes(q) || b.description.toLocaleLowerCase("tr").includes(q));
  }, [bundles, query]);

  const launch = useCallback((bundle: AppBundle) => {
    void api.hideOverlay();
    void api.launchBundle(bundle.id);
  }, []);

  const close = (bundle: AppBundle) => {
    void api.hideOverlay();
    void api.closeBundle(bundle.id);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        void api.hideOverlay();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setIndex((i) => Math.min(rows.length - 1, i + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setIndex((i) => Math.max(0, i - 1));
      } else if (e.key === "Enter") {
        const bundle = rows[index];
        if (bundle) { e.preventDefault(); launch(bundle); }
      } else if (query === "" && /^[1-9]$/.test(e.key)) {
        const bundle = rows[Number(e.key) - 1];
        if (bundle) { e.preventDefault(); launch(bundle); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rows, index, query, launch]);

  useEffect(() => {
    rootRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [index, rows]);

  return (
    <div className="app-overlay" ref={rootRef}>
      <div className="app-overlay-card">
        <div>
          <SearchField
            aria-label="Demet ara"
            placeholder="Demet ara…"
            value={query}
            onValueChange={(q) => { setQuery(q); setIndex(0); }}
          />
        </div>

        <div className="app-overlay-list" role="listbox" aria-label="Demetler">
          {rows.length === 0 ? (
            <EmptyState
              icon={<Play size={26} />}
              title={bundles.length === 0 ? "Henüz demet yok" : "Eşleşen demet yok"}
              description={bundles.length === 0 ? "Yönetim panelinden ilk demetini oluştur." : undefined}
            />
          ) : rows.map((bundle, i) => {
            const count = bundle.items.filter((it) => it.enabled).length;
            return (
              <div
                key={bundle.id}
                role="option"
                aria-selected={i === index}
                className="app-overlay-row"
                onMouseMove={() => setIndex(i)}
                onClick={() => launch(bundle)}
              >
                <span className="app-tile" aria-hidden="true"><BundleGlyph value={bundle.iconEmoji} size={20} /></span>
                <span className="app-item-main">
                  <span className="app-item-name">{bundle.name}</span>
                  <span className="ui-muted app-item-detail">
                    {count} öğe{bundle.hotkey ? ` · ${bundle.hotkey}` : ""}
                  </span>
                </span>
                {query === "" && i < 9 && <Kbd>{String(i + 1)}</Kbd>}
                <button
                  className="ui-icon-btn"
                  aria-label={`${bundle.name} uygulamalarını kapat`}
                  title="Demetteki uygulamaları kapat"
                  onClick={(e) => { e.stopPropagation(); close(bundle); }}
                >
                  <Power size={16} />
                </button>
              </div>
            );
          })}
        </div>

        <div className="app-overlay-foot">
          <span className="ui-muted"><Kbd>↑</Kbd> <Kbd>↓</Kbd> seç · <Kbd>Enter</Kbd> başlat · <Kbd>Esc</Kbd> kapat</span>
          <Button
            icon={<LayoutDashboard size={16} />}
            onClick={() => { void api.hideOverlay(); void api.openDashboard(); }}
          >
            Panel
          </Button>
        </div>
      </div>
    </div>
  );
}
