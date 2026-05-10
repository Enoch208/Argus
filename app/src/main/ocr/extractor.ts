/**
 * Screenshot → OCR text → URL list.
 *
 * ADR-0013. Tesseract.js v5 (pure WASM) handles printed UI text reliably
 * for the demo path (`magic-edenn.io` etc.). The boundary is one function:
 * `extractUrlsFromImage(imageBytes) → { text, domains }`. When PaddleOCR
 * lands as the production runtime, only the worker call below changes.
 *
 * Lifecycle: Tesseract creates a per-call worker, recognises, terminates.
 * Cold start ~2s (downloads the eng-latin model on first use); subsequent
 * calls reuse Tesseract's cached model. We don't pool workers because
 * verdict throughput is human-paced (one screenshot at a time).
 */

import type { Buffer as NodeBuffer } from "node:buffer";
import type * as Tesseract from "tesseract.js";
import { logger } from "@/main/log";

export interface OcrResult {
  /** Whole recognised text. The verdict pipeline doesn't render this; it's
   *  available for diagnostics + future fuzzy matching. */
  text: string;
  /** Normalised, deduped, lowercased domain list extracted from the text. */
  domains: string[];
  /** Canonical Solana brand mentions found in the OCR text (e.g. "phantom",
   *  "magic eden"). Used to cross-reference against `domains` for
   *  brand-impersonation detection. */
  brands: string[];
}

// Cached dynamic import. Tesseract.js is CJS, but lazy-loading keeps boot
// fast — the WASM blob loads only when an image actually arrives.
let workerFactoryPromise: Promise<typeof Tesseract> | null = null;
function loadTesseract(): Promise<typeof Tesseract> {
  if (!workerFactoryPromise) {
    workerFactoryPromise = import("tesseract.js");
  }
  return workerFactoryPromise;
}

export async function extractUrlsFromImage(
  imageBytes: NodeBuffer | Uint8Array,
): Promise<OcrResult> {
  const tesseract = await loadTesseract();
  const worker = await tesseract.createWorker("eng");
  try {
    const { data } = await worker.recognize(Buffer.from(imageBytes));
    const text = data.text ?? "";
    const domains = extractDomains(text);
    const brands = extractBrands(text);
    logger.info("ocr extraction complete", {
      chars: text.length,
      domains: domains.length,
      brands: brands.length,
    });
    return { text, domains, brands };
  } finally {
    await worker.terminate();
  }
}

// ---------------------------------------------------------------------------
// URL extraction
// ---------------------------------------------------------------------------

/**
 * Extract domain candidates from OCR'd text. Matches three shapes that
 * appear in dApp / Telegram / Discord screenshots:
 *
 *   1. Full URLs:  `https://magic-edenn.io/free-mint`
 *   2. Bare domains: `magic-edenn.io` or `solflare.asia`
 *   3. Paths after a domain that OCR may have spliced into surrounding text
 */
export function extractDomains(text: string): string[] {
  const out = new Set<string>();
  const URL_RE =
    /\b(?:https?:\/\/)?((?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,})(?:\/[^\s)]*)?/gi;
  for (const match of text.matchAll(URL_RE)) {
    const host = match[1];
    if (!host) continue;
    const normalised = normaliseDomainLite(host);
    if (looksLikePlausibleDomain(normalised)) out.add(normalised);
  }
  return [...out];
}

/** Same shape rules as `url-intel/store#normaliseDomain`, but local so this
 *  module doesn't import from there (avoids the OCR-extractor importing
 *  domain logic that may later import OCR code). */
function normaliseDomainLite(s: string): string {
  let n = s.trim().toLowerCase();
  n = n.replace(/^https?:\/\//, "");
  n = n.replace(/^www\./, "");
  const slash = n.indexOf("/");
  if (slash !== -1) n = n.slice(0, slash);
  return n;
}

// ---------------------------------------------------------------------------
// Brand extraction
// ---------------------------------------------------------------------------

/**
 * Canonical Solana brands → their canonical apex domain. The verdict pipeline
 * cross-references OCR brand mentions against OCR domain mentions: a screenshot
 * that names a brand without surfacing the brand's canonical domain is a
 * brand-impersonation signal (the screenshot is dressed up as Phantom but the
 * URL is, say, `phantomweb.app`).
 *
 * Keep this aligned with the canonical entries in `main/url-intel/store.ts`.
 */
export const BRAND_TO_DOMAIN: ReadonlyMap<string, string> = new Map([
  ["phantom", "phantom.app"],
  ["solflare", "solflare.com"],
  ["backpack", "backpack.app"],
  ["magic eden", "magiceden.io"],
  ["magiceden", "magiceden.io"],
  ["tensor", "tensor.trade"],
  ["jupiter", "jup.ag"],
  ["raydium", "raydium.io"],
  ["orca", "orca.so"],
  ["drift", "drift.trade"],
  ["marinade", "marinade.finance"],
  ["kamino", "kamino.finance"],
  ["solscan", "solscan.io"],
  ["solanafm", "solana.fm"],
  ["pump.fun", "pump.fun"],
  ["birdeye", "birdeye.so"],
  ["dexscreener", "dexscreener.com"],
  ["dex screener", "dexscreener.com"],
]);

export function canonicalDomainForBrand(brand: string): string | null {
  return BRAND_TO_DOMAIN.get(brand.toLowerCase()) ?? null;
}

/**
 * Returns the deduped, lowercase brand mentions found in OCR text. Match is
 * word-bounded so "tensor" doesn't trigger on "tensorflow" and "drift" doesn't
 * trigger on "drifting".
 */
export function extractBrands(text: string): string[] {
  const haystack = text.toLowerCase();
  const out = new Set<string>();
  for (const brand of BRAND_TO_DOMAIN.keys()) {
    const escaped = brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, "i");
    if (re.test(haystack)) out.add(brand);
  }
  return [...out];
}

/** Filter out obvious false positives from OCR noise: short strings,
 *  things missing a TLD, weird-looking TLDs. */
function looksLikePlausibleDomain(s: string): boolean {
  if (s.length < 4) return false;
  if (!s.includes(".")) return false;
  const tld = s.slice(s.lastIndexOf(".") + 1);
  if (tld.length < 2 || tld.length > 24) return false;
  if (!/^[a-z]+$/.test(tld)) return false;
  return true;
}
