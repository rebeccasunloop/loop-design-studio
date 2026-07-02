import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import type { VerificationResult } from "../types";

const execFileAsync = promisify(execFile);

// Loop brand palette (from skills/loop-brand-deck/build/brand.js + hero recipe).
// Greyscale values (r==g==b) are always allowed.
const BRAND_HEX = new Set(
  [
    "045B3F", "004932", "003926", "011710", "035239", "026648",
    "D2F3A7", "E8F9CC", "F0FAE0",
    "171717", "404040", "737373", "A3A3A3", "D4D4D4", "E5E5E5",
    "F5F5F5", "FAFAFA", "FFFFFF", "000000",
  ].map((h) => h.toUpperCase())
);

function normalizeHex(raw: string): string {
  const h = raw.replace("#", "").toUpperCase();
  if (h.length === 3) return h.split("").map((c) => c + c).join("");
  return h.slice(0, 6);
}

function isGreyscale(hex: string): boolean {
  const r = hex.slice(0, 2), g = hex.slice(2, 4), b = hex.slice(4, 6);
  return r === g && g === b;
}

const TEXT_EXTENSIONS = new Set([".html", ".css", ".svg", ".tsx", ".ts", ".jsx", ".js", ".json", ".md"]);

export function runTokenCheck(files: string[]): { result: VerificationResult; gaps: string[] } {
  const start = Date.now();
  const offenders = new Map<string, Set<string>>();
  let scanned = 0;

  for (const file of files) {
    if (!TEXT_EXTENSIONS.has(path.extname(file).toLowerCase())) continue;
    if (!fs.existsSync(file)) continue;
    scanned++;
    const content = fs.readFileSync(file, "utf-8");
    for (const match of content.matchAll(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g)) {
      const hex = normalizeHex(match[0]);
      if (!BRAND_HEX.has(hex) && !isGreyscale(hex)) {
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

  const list = [...offenders.entries()].map(([hex, fs2]) => `#${hex} (${[...fs2].join(", ")})`);
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
