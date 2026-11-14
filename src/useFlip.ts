import { useCallback, useLayoutEffect, useRef } from "react";

/**
 * Liste öğeleri yer değiştirdiğinde eski konumdan yeni konuma kayarak geçmelerini sağlar (FLIP).
 * Kullanım: öğelere `register(id)` ref'i ver; sırayı değiştirmeden hemen önce `capture()` çağır.
 * `order`, listenin sırasını temsil eden bir metindir (ör. kimliklerin birleşimi).
 */
export function useFlip(order: string) {
  const nodes = useRef(new Map<string, HTMLElement>());
  const before = useRef<Map<string, number> | null>(null);

  const register = useCallback(
    (id: string) => (node: HTMLElement | null) => {
      if (node) nodes.current.set(id, node);
      else nodes.current.delete(id);
    },
    [],
  );

  const capture = useCallback(() => {
    before.current = new Map(
      [...nodes.current].map(([id, node]) => [id, node.getBoundingClientRect().top]),
    );
  }, []);

  useLayoutEffect(() => {
    const previous = before.current;
    before.current = null;
    if (!previous) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    for (const [id, node] of nodes.current) {
      const from = previous.get(id);
      if (from === undefined) continue;
      const delta = from - node.getBoundingClientRect().top;
      if (Math.abs(delta) < 1) continue;
      node.animate(
        [{ transform: `translateY(${delta}px)` }, { transform: "translateY(0)" }],
        { duration: 240, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
      );
    }
  }, [order]);

  return { register, capture };
}
