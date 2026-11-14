// Demet ikon seti: Gravity UI Icons'tan seçilmiş, kategorili liste (Blazon ile ortak).
import { CATEGORIES } from "./icons/catalog.generated";
import type { SymbolDef } from "./icons/types";

export { CATEGORIES };
export type { SymbolDef };

export const ALL_SYMBOLS: SymbolDef[] = CATEGORIES.flatMap((c) => c.icons);

const byId = new Map(ALL_SYMBOLS.map((s) => [s.id, s]));
export const symbolById = (id: string | null | undefined) => (id ? byId.get(id) ?? null : null);

/** SVG metni; renk currentColor'dan gelir. */
export const symbolSvg = (s: SymbolDef, size = 20) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${s.viewBox}" fill="none">${s.body}</svg>`;

/** Türkçe karakterlere duyarsız arama. */
const fold = (text: string) =>
  text.toLocaleLowerCase("tr").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i");

export function searchSymbols(query: string): SymbolDef[] {
  const q = fold(query.trim());
  if (!q) return [];
  return ALL_SYMBOLS.filter(
    (s) => fold(s.label).includes(q) || fold(s.labelEn).includes(q) || s.id.includes(q),
  );
}
