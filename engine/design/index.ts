/**
 * Outils de design publics : mesure de contraste WCAG 2.x sur les couleurs
 * réellement employées. Seules des couleurs opaques sRGB (#rrggbb) sont
 * mesurées ; une couleur composée (transparence, color-mix, texte sur image)
 * doit être mesurée sur le rendu, pas ici.
 */

export function parseHex(hex: string): [number, number, number] {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m?.[1]) throw new Error(`couleur #rrggbb attendue : ${hex}`);
  const n = Number.parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const channel = (c: number) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

export function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrast(fg: string, bg: string): number {
  const [a, b] = [luminance(fg), luminance(bg)].sort((x, y) => y - x) as [number, number];
  return (a + 0.05) / (b + 0.05);
}

export interface Pairing {
  fg: string;
  bg: string;
  use: string;
  /** Texte de grande taille (≥ 24px, ou ≥ 18,66px gras) : seuil 3:1. Composant/graphisme : 3:1. */
  kind: 'text' | 'large-text' | 'ui';
}

export function evaluate(p: Pairing): { ratio: number; required: number; pass: boolean } {
  const ratio = Math.round(contrast(p.fg, p.bg) * 100) / 100;
  const required = p.kind === 'text' ? 4.5 : 3;
  return { ratio, required, pass: ratio >= required };
}
