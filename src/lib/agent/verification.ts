import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import type { VerificationResult } from "../types";
import { loadBrandPalette, nearestToken } from "./brand-palette";

const execFileAsync = promisify(execFile);

// Allowed colors come from the Loop palette (brand.js + design-system doc).
// Greyscale values (r==g==b) are additionally allowed — shadows, overlays.
function normalizeHex(raw: string): string {
  let h = raw.replace("#", "").toUpperCase();
  if (h.length === 3 || h.length === 4) {
    // #RGB / #RGBA → expand channels, drop alpha
    h = h.slice(0, 3).split("").map((c) => c + c).join("");
  }
  return h.slice(0, 6); // #RRGGBBAA → drop alpha
}

function isGreyscale(hex: string): boolean {
  const r = hex.slice(0, 2), g = hex.slice(2, 4), b = hex.slice(4, 6);
  return r === g && g === b;
}

function rgbToHex(r: number, g: number, b: number): string {
  return [r, g, b]
    .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

function* extractColors(content: string): Generator<string> {
  for (const match of content.matchAll(/#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/g)) {
    yield normalizeHex(match[0]);
  }
  // rgb()/rgba() — alpha is ignored; the underlying color must be a token.
  for (const match of content.matchAll(/rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/g)) {
    yield rgbToHex(Number(match[1]), Number(match[2]), Number(match[3]));
  }
}

const TEXT_EXTENSIONS = new Set([".html", ".css", ".svg", ".tsx", ".ts", ".jsx", ".js", ".json", ".md"]);

export function runTokenCheck(files: string[]): { result: VerificationResult; gaps: string[] } {
  const start = Date.now();
  const palette = loadBrandPalette();
  const offenders = new Map<string, Set<string>>();
  let scanned = 0;

  for (const file of files) {
    if (!TEXT_EXTENSIONS.has(path.extname(file).toLowerCase())) continue;
    if (!fs.existsSync(file)) continue;
    scanned++;
    const content = fs.readFileSync(file, "utf-8");
    for (const hex of extractColors(content)) {
      if (!palette.has(hex) && !isGreyscale(hex)) {
        if (!offenders.has(hex)) offenders.set(hex, new Set());
        offenders.get(hex)!.add(path.basename(file));
      }
    }
  }

  if (scanned === 0) {
    return {
      result: { step: "token-check", status: "skip", detail: "No text artifacts to scan", durationMs: Date.now() - start },
      gaps: [],
    };
  }

  if (offenders.size === 0) {
    return {
      result: {
        step: "token-check",
        status: "pass",
        detail: `Scanned ${scanned} file(s); all colors match Loop brand tokens or greyscale`,
        durationMs: Date.now() - start,
      },
      gaps: [],
    };
  }

  const list = [...offenders.entries()].map(([hex, inFiles]) => {
    const nearest = nearestToken(hex);
    const hint = nearest && nearest.distance <= 40 ? ` — closest token: ${nearest.name} #${nearest.hex}` : "";
    return `#${hex} (${[...inFiles].join(", ")})${hint}`;
  });
  return {
    result: {
      step: "token-check",
      status: "fail",
      detail: `Off-palette colors found: ${list.join("; ")}`,
      durationMs: Date.now() - start,
    },
    gaps: list.map((l) => `Off-palette color in artifact: ${l}`),
  };
}

const CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

export async function runScreenshot(
  sessionDir: string,
  files: string[]
): Promise<{ result: VerificationResult; screenshotPath: string | null }> {
  const start = Date.now();
  const html = files.find((f) => f.endsWith(".html") && fs.existsSync(f));
  if (!html) {
    return {
      result: { step: "screenshot", status: "skip", detail: "No HTML artifact to render", durationMs: Date.now() - start },
      screenshotPath: null,
    };
  }
  if (!fs.existsSync(CHROME_PATH)) {
    return {
      result: { step: "screenshot", status: "skip", detail: "Headless Chrome not available", durationMs: Date.now() - start },
      screenshotPath: null,
    };
  }

  const out = path.join(sessionDir, "preview.png");
  try {
    await execFileAsync(
      CHROME_PATH,
      [
        "--headless",
        "--disable-gpu",
        "--hide-scrollbars",
        "--window-size=1280,800",
        `--screenshot=${out}`,
        `file://${html}`,
      ],
      { timeout: 30000 }
    );
    const ok = fs.existsSync(out) && fs.statSync(out).size > 0;
    return {
      result: {
        step: "screenshot",
        status: ok ? "pass" : "fail",
        detail: ok ? `Rendered ${path.basename(html)} headlessly (preview.png)` : "Screenshot file was not produced",
        durationMs: Date.now() - start,
      },
      screenshotPath: ok ? out : null,
    };
  } catch (err) {
    return {
      result: {
        step: "screenshot",
        status: "fail",
        detail: `Headless render failed: ${err instanceof Error ? err.message : String(err)}`,
        durationMs: Date.now() - start,
      },
      screenshotPath: null,
    };
  }
}
