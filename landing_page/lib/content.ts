/**
 * Single source of truth for all landing-page copy.
 *
 * STRICT RULE: do not place copy strings in components. Edit here so localisation
 * and tone-tuning happen in one diff.
 *
 * Truth bar: every claim on this page must map to a verifiable feature in
 * `/app/`. If something here drifts ahead of the implementation, fix it
 * here — not the other way round.
 */

import {
  Bot,
  Connect,
  Cpu,
  Earth,
  FileSearch,
  FingerPrint,
  Flash,
  Layers,
  Mic,
  Shield,
  Sparkles,
  View,
  VolumeHigh,
  Wallet,
  type Icon,
} from "@/lib/icons";

// -----------------------------------------------------------------------------
// Brand / global
// -----------------------------------------------------------------------------

export const BRAND = {
  name: "Argus",
  tagline: "Local AI in front of every signature.",
  github: "https://github.com/Enoch208/Argus",
  x: "https://x.com/use_argus",
  builtWith: "Built on @qvac/sdk + WDK",
} as const;

export const NAV_LINKS = [
  { label: "Pipeline", href: "#pipeline" },
  { label: "Stack", href: "#stack" },
  { label: "Threats", href: "#threats" },
] as const;

// macOS DMG + Windows portable ZIP, hosted as assets on the v0.1.0 GitHub
// Release at `github.com/Enoch208/Argus/releases/tag/v0.1.0`. Each click
// hits GitHub's CDN — no extra hosting layer, signed URLs, or build step.
const RELEASE = "https://github.com/Enoch208/Argus/releases/download/v0.1.0";

export const DOWNLOADS = {
  mac: {
    label: "Download for Mac",
    sub: "Apple Silicon · DMG · 1.3 GB",
    href: `${RELEASE}/Argus-0.1.0-arm64.dmg`,
  },
  win: {
    label: "Download for Windows",
    sub: "x64 · portable ZIP · 946 MB",
    href: `${RELEASE}/Argus-0.1.0-win-x64-portable.zip`,
  },
} as const;

// -----------------------------------------------------------------------------
// Hero
// -----------------------------------------------------------------------------

export const HERO = {
  marker: { num: "01", label: "Concept" },
  badge: "v0.1 · Built on @qvac/sdk",
  // Two short lines. Together they read as one sentence.
  headline: ["Stop the drainer", "before you sign."],
  // Single-line subhead. Anything longer reads as a paragraph in a hero.
  sub: "A local AI co-pilot that reviews every Solana signature on-device. Nothing leaves your machine.",
  // Two ornaments — kept minimal; the hero should breathe.
  nodes: [
    {
      pos: "top-[18%] left-[5%]",
      reverse: false,
      icon: Cpu as Icon,
      label: "Verdict explainer",
      meta: "Qwen3-1.7B · @qvac/sdk",
      dotClass: "bg-emerald-400/80 shadow-[0_0_8px_rgba(52,211,153,0.8)]",
    },
    {
      pos: "bottom-[22%] right-[5%]",
      reverse: true,
      icon: FingerPrint as Icon,
      label: "Personal-history RAG",
      meta: "bge-small · 384-d",
      dotClass: "bg-amber-400/80 shadow-[0_0_8px_rgba(251,191,36,0.7)]",
    },
  ],
} as const;

// -----------------------------------------------------------------------------
// Verdict demo (cards rendered as visual proof)
//
// Every card below uses the *exact* citation phrasing produced by the live
// verdict pipeline (`/app/src/main/verdict/pipeline.ts`). If you change the
// pipeline's citation strings, mirror them here.
// -----------------------------------------------------------------------------

export type Verdict = "GREEN" | "YELLOW" | "RED";

export const VERDICTS: Array<{
  level: Verdict;
  title: string;
  summary: string;
  citations: string[];
  meta: string;
}> = [
  {
    level: "RED",
    title: "Refuse to engage — brand impersonation",
    summary: "Screenshot impersonates Magic Eden (real domain magiceden.io).",
    citations: [
      "OCR found 1 blocked domain: magic-edenn.io (Phantom-flagged typo-squat of magiceden.io).",
      "Brand-impersonation: screenshot mentions magic eden but the URL is magic-edenn.io, not magiceden.io.",
      "Personal history matched 0 similar approved reviews; treat this as unusual for your wallet.",
    ],
    meta: "OCR · Brand · impersonation · History",
  },
  {
    level: "YELLOW",
    title: "Review — unlimited SPL approval",
    summary: "spl-approve to a delegate Argus has not seen on this wallet.",
    citations: [
      "Simulation passed (1 instruction).",
      "spl-approve: unlimited delegate authority to 9xQe…2bWk on USDC.",
      "Local scam-intel checked 1 program; no blocklist matches.",
      "Personal history found no close match across 47 prior reviews; treat this as unusual for your wallet.",
    ],
    meta: "Simulation · Intel · History",
  },
  {
    level: "GREEN",
    title: "Approve — Jupiter v6 swap",
    summary: "Routine SOL → USDC, recipient is your own wallet.",
    citations: [
      "Simulation passed (1 instruction).",
      "Jupiter v6 route: -0.50 SOL, +71.24 USDC to your wallet.",
      "Local scam-intel checked 1 program; no blocklist matches.",
      "Personal history matched 4 similar approved reviews.",
    ],
    meta: "Simulation · Intel · History · match",
  },
];

// -----------------------------------------------------------------------------
// Why-local
// -----------------------------------------------------------------------------

export const WHY_LOCAL = {
  marker: { num: "02", label: "Why local AI" },
  title: ["The reviewer that doesn't", "leak the transaction."],
  body:
    "Cloud screening sees every signature you'd want it to protect. Argus runs the entire review pipeline — decode, simulate, intel lookup, RAG, explainer LLM — on your device through the official QVAC SDK.",
  stat: "$2.1B",
  statLabel: "Stolen by Solana drainers in 2024",
} as const;

// -----------------------------------------------------------------------------
// Pipeline cards
// -----------------------------------------------------------------------------

export const PIPELINE_INTRO = {
  marker: { num: "03", label: "Pipeline" },
  title: ["Five on-device signals,", "one cited verdict."],
  body:
    "Decode → simulate → intel → screenshot OCR → personal-history RAG. The QVAC-powered explainer turns the deterministic facts into plain English; every citation is something your machine can verify.",
} as const;

export type PipelineCard = {
  icon: Icon;
  title: string;
  blurb: string;
  variant: "code" | "orbit" | "sonar";
};

export const PIPELINE_CARDS: PipelineCard[] = [
  {
    icon: Bot,
    title: "Decode & explain",
    blurb:
      "Qwen3-1.7B (via @qvac/sdk) rewrites the deterministic decode into plain English. The model never adds facts — every claim has a citation.",
    variant: "code",
  },
  {
    icon: Connect,
    title: "Cross-reference",
    blurb:
      "35 wallet/program/mint entries from Mandiant CLINKSINK + SolanaFM, plus 2,247 domains from the Phantom blocklist scrape, plus BGE-embedded personal history — all converging on a single severity.",
    variant: "orbit",
  },
  {
    icon: FingerPrint,
    title: "Read the screenshot",
    blurb:
      "Drag in a Telegram or dApp screenshot. Tesseract OCR extracts URLs and brand mentions; brand-impersonation cross-reference catches typo-squat phishing kits.",
    variant: "sonar",
  },
];

// -----------------------------------------------------------------------------
// QVAC integration matrix
// -----------------------------------------------------------------------------

export const QVAC_MARKER = { num: "04", label: "Stack" } as const;

export type QvacRow = {
  icon: Icon;
  module: string;
  use: string;
  path: string;
  status?: "live" | "reserved";
};

export const QVAC_ROWS: QvacRow[] = [
  {
    icon: Sparkles,
    module: "@qvac/sdk · completion",
    use: "Verdict-explainer LLM (Qwen3-1.7B). Plain-English rewrite of decoded facts; structured JSON output validated by zod.",
    path: "src/main/verdict/explainer.ts",
    status: "live",
  },
  {
    icon: FingerPrint,
    module: "@qvac/sdk · embed",
    use: "Personal-history RAG over your prior signed/blocked reviews. bge-small-en-v1.5, cosine, 384-d.",
    path: "src/main/llm/embedder.ts",
    status: "live",
  },
  {
    icon: FileSearch,
    module: "@qvac/sdk · ocr",
    use: "EasyOCR pipeline (CRAFT detector + Latin recognizer) over screenshot bytes. Returns URLs + brand mentions for the impersonation cross-reference.",
    path: "src/main/ocr/extractor.ts",
    status: "live",
  },
  {
    icon: Mic,
    module: "@qvac/sdk · transcribe",
    use: "Voice command — say 'approve' or 'block' on the queued review. MediaRecorder → @qvac/transcription-whispercpp → keyword match.",
    path: "src/main/ipc/handlers/voice.ts",
    status: "live",
  },
  {
    icon: VolumeHigh,
    module: "@qvac/sdk · textToSpeech",
    use: "Verdict readback through the renderer's AudioContext. Chatterbox q4f16, multilingual.",
    path: "src/renderer/components/verdict/read-aloud.tsx",
    status: "live",
  },
];

// -----------------------------------------------------------------------------
// Threat catalog
// -----------------------------------------------------------------------------

export const THREAT_MARKER = { num: "05", label: "Threats" } as const;

export type Threat = {
  icon: Icon;
  title: string;
  body: string;
};

export const THREATS: Threat[] = [
  {
    icon: Shield,
    title: "Known-bad recipient",
    body: "Transfer or approval to an address in the local scam-intel corpus (Mandiant CLINKSINK + SolanaFM seeds).",
  },
  {
    icon: Wallet,
    title: "Unlimited SPL approval",
    body: "`Approve` granting unbounded delegate authority to a program your wallet has never interacted with.",
  },
  {
    icon: Layers,
    title: "Authority hijack",
    body: "`setAuthority` flipping mint or freeze authority on an account you own.",
  },
  {
    icon: Flash,
    title: "Simulation rejection",
    body: "Solana simulator rejects the transaction — Argus will not sign anything that won't even simulate.",
  },
  {
    icon: FingerPrint,
    title: "Typo-squat URL",
    body: "Screenshot URL is one Levenshtein edit away from a canonical Solana dApp (magicedem.io, jupx.ag, …).",
  },
  {
    icon: View,
    title: "Brand impersonation",
    body: "Screenshot mentions a canonical brand without surfacing its real domain — phishing dressed up as Phantom, Magic Eden, etc.",
  },
];

// -----------------------------------------------------------------------------
// CTA + Footer
// -----------------------------------------------------------------------------

export const CTA = {
  title: ["Local intelligence,", "zero exfiltration."],
  body:
    "Install Argus, generate a fresh seed, and review your next signature with a stack you fully own — every model on the call path runs through the official QVAC SDK on your device.",
} as const;

export const FOOTER = {
  links: [
    {
      heading: "Product",
      items: [
        { label: "Download", href: "#download" },
        { label: "Pipeline", href: "#pipeline" },
        { label: "Stack", href: "#stack" },
        { label: "Threats", href: "#threats" },
      ],
    },
    {
      heading: "Repository",
      items: [
        { label: "GitHub", href: BRAND.github },
        { label: "X", href: BRAND.x },
        { label: "PRD", href: "https://github.com/Enoch208/Argus/blob/main/prd.md" },
        { label: "Architecture", href: "https://github.com/Enoch208/Argus/blob/main/README.md" },
      ],
    },
    {
      heading: "Built with",
      items: [
        { label: "@qvac/sdk", href: "https://www.npmjs.com/package/@qvac/sdk" },
        { label: "WDK", href: "https://wdk.tether.io" },
        { label: "Solana", href: "https://solana.com" },
        { label: "Electron", href: "https://www.electronjs.org" },
      ],
    },
  ],
  hackathon: {
    label: "Solana Frontier · QVAC Track",
    deadline: "May 11 · 2026",
  },
} as const;

export { Earth };
