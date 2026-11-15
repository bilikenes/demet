import { useEffect, useRef } from "react";

/** Kenar çubuğunun üstündeki maymun döngüsü. Pencere odakta değilken ya da gizliyken durur. */
export function SidebarMonkey({ mode }: { mode: "light" | "dark" }) {
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = video.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const sync = () => {
      const active = !reduce && !document.hidden && document.hasFocus();
      if (active) void el.play().catch(() => {});
      else el.pause();
    };
    sync();
    window.addEventListener("focus", sync);
    window.addEventListener("blur", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      window.removeEventListener("focus", sync);
      window.removeEventListener("blur", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [mode]);

  return (
    <div className={`app-sidebar-monkey is-${mode}`} aria-hidden="true">
      {/* Parlaklığı saydamlığa çevirir: koyu videoda koyu zemin, açık videoda beyaz kâğıt kaybolur. */}
      <svg width="0" height="0" style={{ position: "absolute" }} focusable="false">
        <filter id="monkey-key-dark" x="0" y="0" width="1" height="1" colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0.55 1.85 0.19 0 -0.31" />
        </filter>
        <filter id="monkey-key-light" x="0" y="0" width="1" height="1" colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  -0.7 -2.36 -0.24 0 3.3" />
        </filter>
      </svg>
      <video key={mode} ref={video} src={mode === "dark" ? "/sidebar-monkey-dark.webm" : "/sidebar-monkey.webm"} muted loop playsInline autoPlay preload="auto" onLoadedData={(e) => e.currentTarget.classList.add("is-ready")} />
    </div>
  );
}
