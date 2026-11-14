// Sembol seçici (Blazon'daki seçicinin Amber UI uyarlaması):
//  - üstte kategori ikon şeridi; aktif kategorinin altında kayan bir çizgi var,
//  - altında tüm semboller tek dikey listede; kaydırdıkça aktif kategori değişir,
//    şeritteki kategoriye basınca liste oraya kayar,
//  - seçili sembolün zemini, seçim değişince yeni sembole kayar,
//  - şeridin başındaki büyüteç şeridi arama kutusuna çevirir.
import { useLayoutEffect, useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { BundleGlyph } from "./BundleGlyph";
import { CATEGORIES, searchSymbols, symbolById, symbolSvg, type SymbolDef } from "./symbols";

const CATEGORY_ICON: Record<string, string> = {
  general: "star", work: "briefcase", dev: "code", design: "palette", media: "music-note",
  finance: "wallet", learn: "book-open", life: "house", system: "gear",
};

function categoryGlyph(categoryId: string): string {
  const category = CATEGORIES.find((c) => c.id === categoryId);
  const symbol = symbolById(CATEGORY_ICON[categoryId]) ?? category?.icons[0];
  return symbol ? symbolSvg(symbol, 16) : "";
}

/** Bir tıkla başlayan kaydırma sürerken şerit, ara kategorilerde zıplamasın. */
const JUMP_LOCK_MS = 520;

export function SymbolPicker({
  value, onChange, onConfirm,
}: {
  value: string;
  onChange: (id: string) => void;
  /** Bir ikona çift tıklanınca seçimi onaylamak için. */
  onConfirm?: () => void;
}) {
  const [active, setActive] = useState(() => {
    const own = CATEGORIES.find((c) => c.icons.some((s) => s.id === value));
    return own?.id ?? CATEGORIES[0].id;
  });
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [ready, setReady] = useState(false);
  const results = query.trim() ? searchSymbols(query) : null;

  const strip = useRef<HTMLDivElement>(null);
  const line = useRef<HTMLSpanElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const mark = useRef<HTMLSpanElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const lockUntil = useRef(0);

  // Aktif kategorinin altındaki çizgiyi yerleştir.
  useLayoutEffect(() => {
    const tab = strip.current?.querySelector<HTMLElement>(`[data-tab="${active}"]`);
    const el = line.current;
    if (!tab || !el) return;
    el.style.width = `${tab.offsetWidth - 8}px`;
    el.style.transform = `translateX(${tab.offsetLeft + 4}px)`;
    el.style.opacity = "1";
  }, [active, searchOpen]);

  // Seçili sembolün zeminini yerleştir (kategoriler arasında da kayar).
  useLayoutEffect(() => {
    const target = content.current?.querySelector<HTMLElement>(`[data-id="${value}"]`);
    const el = mark.current;
    if (!el) return;
    if (!target) {
      el.style.opacity = "0";
      return;
    }
    el.style.width = `${target.offsetWidth}px`;
    el.style.height = `${target.offsetHeight}px`;
    el.style.transform = `translate(${target.offsetLeft}px, ${target.offsetTop}px)`;
    el.style.opacity = "1";
  }, [value, query, searchOpen]);

  // İlk yerleşimden sonra geçişleri aç; böylece açılışta sol üstten kaymaz.
  useEffect(() => {
    const frame = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  // Seçili ikon açılışta görünür olsun.
  useEffect(() => {
    const target = content.current?.querySelector<HTMLElement>(`[data-id="${value}"]`);
    target?.scrollIntoView({ block: "center" });
    // yalnızca açılışta
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (searchOpen) input.current?.focus();
  }, [searchOpen]);

  const closeSearch = () => {
    setSearchOpen(false);
    setQuery("");
  };

  const onScroll = () => {
    const el = scroller.current;
    if (!el || results || Date.now() < lockUntil.current) return;
    const edge = el.getBoundingClientRect().top + 24;
    let current = CATEGORIES[0].id;
    for (const section of el.querySelectorAll<HTMLElement>("[data-cat]")) {
      if (section.getBoundingClientRect().top <= edge) current = section.dataset.cat!;
    }
    setActive(current);
  };

  const jumpTo = (id: string) => {
    const el = scroller.current;
    const section = el?.querySelector<HTMLElement>(`[data-cat="${id}"]`);
    if (!el || !section) return;
    lockUntil.current = Date.now() + JUMP_LOCK_MS;
    setActive(id);
    el.scrollTo({
      top: el.scrollTop + section.getBoundingClientRect().top - el.getBoundingClientRect().top,
      behavior: "smooth",
    });
  };

  const grid = (items: SymbolDef[]) => (
    <div className="app-sp-grid">
      {items.map((symbol) => (
        <button
          key={symbol.id}
          className="app-sp-btn"
          data-id={symbol.id}
          data-on={value === symbol.id}
          title={symbol.label}
          aria-label={symbol.label}
          aria-pressed={value === symbol.id}
          onClick={() => onChange(symbol.id)}
          onDoubleClick={onConfirm}
        >
          <BundleGlyph value={symbol.id} size={20} />
        </button>
      ))}
    </div>
  );

  return (
    <div className="app-sp" data-ready={ready}>
      <div className="app-sp-strip" ref={strip}>
        {searchOpen ? (
          <label className="app-sp-search">
            <Search size={16} />
            <input
              ref={input}
              value={query}
              placeholder="İkon ara…"
              spellCheck={false}
              aria-label="İkon ara"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.stopPropagation();
                  closeSearch();
                }
              }}
            />
            <button type="button" className="ui-icon-btn" aria-label="Aramayı kapat" onClick={closeSearch}>
              <X size={16} />
            </button>
          </label>
        ) : (
          <>
            <button type="button" className="app-sp-tab" aria-label="İkon ara" title="İkon ara" onClick={() => setSearchOpen(true)}>
              <Search size={16} />
            </button>
            <span className="app-sp-sep" />
            {CATEGORIES.map((category) => (
              <button
                key={category.id}
                type="button"
                className="app-sp-tab"
                data-tab={category.id}
                data-on={active === category.id}
                title={category.label}
                aria-label={category.label}
                onClick={() => jumpTo(category.id)}
                dangerouslySetInnerHTML={{ __html: categoryGlyph(category.id) }}
              />
            ))}
            <span className="app-sp-line" ref={line} aria-hidden="true" />
          </>
        )}
      </div>

      <div className="app-sp-scroll" ref={scroller} onScroll={onScroll}>
        <div className="app-sp-content" ref={content}>
          <span className="app-sp-mark" ref={mark} aria-hidden="true" />
          {results ? (
            results.length ? grid(results) : <p className="ui-muted app-sp-empty">“{query}” için sonuç yok.</p>
          ) : (
            CATEGORIES.map((category) => (
              <section key={category.id} data-cat={category.id}>
                <h4 className="app-sp-title">{category.label}</h4>
                {grid(category.icons)}
              </section>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
