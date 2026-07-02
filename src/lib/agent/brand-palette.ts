import fs from "fs";
import path from "path";

// Named Loop palette. Sources: skills/loop-brand-deck/build/brand.js (token
// source of truth) and the Loop Design System doc (Figma "Colors · Alias"
// frame + next-app Tailwind theme.css). Names are used for nearest-token
// suggestions when an off-palette color is found.
const NAMED_TOKENS: Record<string, string> = {
  // Brand ramp (Loop Green)
  EAFAF2: "brand-25",
  D9F5E6: "brand-50",
  BBE5D0: "brand-100",
  "94CCB1": "brand-200",
  "67AC8D": "brand-300",
  "348263": "brand-400",
  "045B3F": "brand-500",
  "004932": "brand-600",
  "003926": "brand-700",
  "00291A": "brand-800",
  "001D11": "brand-900",
  "0F3B00": "brand-physical-card",
  // Neutrals (Tailwind neutral)
  FFFFFF: "white",
  FAFAFA: "neutral-50",
  F5F5F5: "neutral-100",
  E5E5E5: "neutral-200",
  D4D4D4: "neutral-300",
  A3A3A3: "neutral-400",
  "737373": "neutral-500",
  "525252": "neutral-600",
  "404040": "neutral-700",
  "262626": "neutral-800",
  "171717": "neutral-900",
  "0A0A0A": "neutral-950",
  "000000": "black",
  // Accents (decorative / alternate button moments only)
  D2F3A7: "accent-bright-green",
  F2FCE4: "accent-light-green",
  "8F5CCF": "accent-purple",
  EED9F7: "accent-lilac",
  F7ECFB: "accent-light-lilac",
  "6B3F88": "accent-dark-lilac",
  CFE5F3: "accent-blue",
  E8F3FA: "accent-light-blue",
  // Semantic
  F12D1B: "semantic-error",
  FEF1ED: "semantic-error-bg",
  F04438: "border-error",
  "30AC2E": "semantic-success",
  DC6803: "semantic-warning",
  FFFAEB: "semantic-warning-bg",
  "1570EF": "semantic-info",
};

let cachedPalette: Set<string> | null = null;

/**
 * Allowed hex values: the named palette above, unioned with every hex string
 * literal in the deck skill's brand.js so new tokens added there are picked
 * up without touching this file.
 */
export function loadBrandPalette(): Set<string> {
  if (cachedPalette) return cachedPalette;
  const palette = new Set(Object.keys(NAMED_TOKENS));
  const brandJs = path.join(process.cwd(), "skills", "loop-brand-deck", "build", "brand.js");
  if (fs.existsSync(brandJs)) {
    const source = fs.readFileSync(brandJs, "utf-8");
    for (const match of source.matchAll(/"([0-9a-fA-F]{6})"/g)) {
      palette.add(match[1].toUpperCase());
    }
  }
  cachedPalette = palette;
  return palette;
}

export function nearestToken(hex: string): { name: string; hex: string; distance: number } | null {
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  let best: { name: string; hex: string; distance: number } | null = null;
  for (const [tokenHex, name] of Object.entries(NAMED_TOKENS)) {
    const tr = parseInt(tokenHex.slice(0, 2), 16);
    const tg = parseInt(tokenHex.slice(2, 4), 16);
    const tb = parseInt(tokenHex.slice(4, 6), 16);
    const distance = Math.sqrt((r - tr) ** 2 + (g - tg) ** 2 + (b - tb) ** 2);
    if (!best || distance < best.distance) {
      best = { name, hex: tokenHex, distance };
    }
  }
  return best;
}

/** Human-readable palette summary for agent prompts. */
export function paletteSummary(): string {
  const groups: Record<string, string[]> = {};
  for (const [hex, name] of Object.entries(NAMED_TOKENS)) {
    const group = name.split("-")[0];
    (groups[group] ??= []).push(`${name} #${hex}`);
  }
  return Object.values(groups)
    .map((entries) => entries.join(", "))
    .join("; ");
}
