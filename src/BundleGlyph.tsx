import { symbolById, symbolSvg } from "./symbols";

/**
 * Demet ikonu. Değer bir sembol kimliğiyse (ör. "rocket") SVG çizilir;
 * eski sürümden kalan emoji ise olduğu gibi gösterilir.
 */
export function BundleGlyph({ value, size = 18 }: { value: string; size?: number }) {
  const symbol = symbolById(value);
  if (!symbol) return <span aria-hidden="true">{value}</span>;
  return (
    <span
      className="app-glyph"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: symbolSvg(symbol, size) }}
    />
  );
}
