import { useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "./api";

const fileCache = new Map<string, Promise<string | null>>();
const siteCache = new Map<string, Promise<string | null>>();

function memo(cache: Map<string, Promise<string | null>>, key: string, load: () => Promise<string | null>) {
  let pending = cache.get(key);
  if (!pending) {
    pending = load().catch(() => null);
    cache.set(key, pending);
  }
  return pending;
}

const hostOf = (url: string) => {
  try {
    return new URL(/^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`).host.toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
};

/**
 * Kutucuk içinde simge gösterir: `path` bir dosyanın Windows simgesini, `siteUrl` sitenin
 * favicon'unu getirir; yoksa ya da yüklenene kadar `fallback` görünür.
 * İstekler yalnızca kutucuk görünür olunca yapılır (uzun listeler için).
 */
export function AppTile({
  path, siteUrl, fallback, large,
}: { path?: string; siteUrl?: string; fallback: ReactNode; large?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  const [src, setSrc] = useState<string | null>(null);
  const source = path ?? siteUrl;

  useEffect(() => {
    const node = ref.current;
    if (!node || !source) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [source]);

  useEffect(() => {
    setSrc(null);
    if (!visible || !source) return;
    let cancelled = false;
    const request = path
      ? memo(fileCache, path.trim().toLowerCase(), () => api.getIcon(path))
      : memo(siteCache, hostOf(source), () => api.getFavicon(source));
    request.then((url) => { if (!cancelled) setSrc(url); });
    return () => { cancelled = true; };
  }, [visible, source, path]);

  return (
    <span ref={ref} className={large ? "app-tile is-lg" : "app-tile"} aria-hidden="true">
      {src ? <img src={src} alt="" /> : fallback}
    </span>
  );
}
