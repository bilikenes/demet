import { useEffect, useRef } from "react";
import { mountWayglim } from "./engine.js";
import presets from "./presets.json";

type Mode = "light" | "dark";

const ASPECT = 16 / 9;
/** Yumuşak bir efekt olduğu için ekran çözünürlüğünün bir kısmında çizilir; GPU yükünü belirgin azaltır. */
const RENDER_SCALE = 0.6;
const TUNING = {
  dark: { speed: 25, intensity: 45, grain: 12, glow: 42, background: [0.0902, 0.0824, 0.0588] },
  light: { speed: 25, intensity: 70, grain: 16, glow: 42, background: [0.9137, 0.898, 0.8549] },
} as const;
/** Koyu tema: turuncuya yakın amber (#f08c1e); örnek sayfadaki renk seçicinin ürettiği dört ton. */
const DARK_BASE = [0xf0 / 255, 0x8c / 255, 0x1e / 255];
const DARK_COLORS = [
  DARK_BASE,
  DARK_BASE.map((v) => Math.min(1, v * 0.65 + 0.22)),
  DARK_BASE.map((v) => v * 0.55),
  DARK_BASE.map((v) => Math.min(1, v * 0.85 + 0.08)),
];
/** Açık tema: koyu temadaki kum tonlarının, kum zemine oturan biraz daha koyu hali. */
const LIGHT_COLORS = [
  [0.7, 0.52, 0.34], [0.84, 0.68, 0.5], [0.58, 0.4, 0.24], [0.78, 0.6, 0.42],
];

/**
 * Sayfanın arkasında yavaşça akan ışık. Pencereye sabitlenir (içerikle kaymaz) ve
 * her pencere boyutunda hareketli kısım görünsün diye 16:9 çizim alanı alta hizalı "cover" ile yerleşir.
 */
export function AnimatedBackground({ mode }: { mode: Mode }) {
  const stage = useRef<HTMLDivElement>(null);
  const art = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stageEl = stage.current;
    const artEl = art.current;
    if (!stageEl || !artEl) return;

    const place = () => {
      const w = stageEl.clientWidth;
      const h = stageEl.clientHeight;
      const bw = Math.max(w, h * ASPECT);
      const bh = bw / ASPECT;
      artEl.style.width = `${bw}px`;
      artEl.style.height = `${bh}px`;
      artEl.style.left = `${(w - bw) / 2}px`;
      artEl.style.top = `${h - bh}px`;
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(stageEl);

    const tuning = TUNING[mode];
    const settings = JSON.parse(JSON.stringify(presets[0].settings));
    settings.background = [...tuning.background];
    settings.pace = Math.max(0.05, tuning.speed / 100);
    settings.maxPixelRatio = RENDER_SCALE;
    settings.pauseOffscreen = true;
    settings.respectReducedMotion = true;
    settings.startSeconds = 12;
    settings.params.glow = tuning.glow;
    settings.params.grainAmount = tuning.grain;
    settings.params.grainEnabled = tuning.grain > 0;
    settings.params.pointer.enabled = false;
    settings.params.customColors = (mode === "light" ? LIGHT_COLORS : DARK_COLORS).map((c) => [...c]);
    settings.params.spectrum = "custom";
    artEl.style.opacity = String(tuning.intensity / 100);

    let player: ReturnType<typeof mountWayglim> | null = null;
    try { player = mountWayglim(artEl, settings); } catch { /* WebGL 2 yoksa düz zemin kalır */ }
    // Pencere arka plandayken (başka uygulama ön planda ya da küçültülmüş) çizme.
    const sync = () => player?.setPaused(document.hidden || !document.hasFocus());
    sync();
    window.addEventListener("focus", sync);
    window.addEventListener("blur", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      window.removeEventListener("focus", sync);
      window.removeEventListener("blur", sync);
      document.removeEventListener("visibilitychange", sync);
      observer.disconnect();
      player?.destroy();
    };
  }, [mode]);

  return (
    <div ref={stage} className="app-bgfx" aria-hidden="true">
      <div ref={art} className="app-bgfx-art" />
    </div>
  );
}
