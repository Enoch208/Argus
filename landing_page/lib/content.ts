/**
 * Single source of truth for all landing-page copy.
 *
 * STRICT RULE: do not place copy strings in components. Edit here so localisation
 * and tone-tuning happen in one diff.
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
  github: "https://github.com/yourname/Argus",
  builtWith: "Built with QVAC + WDK",
} as const;

export const NAV_LINKS = [
  { label: "Pipeline", href: "#pipeline" },
  { label: "Stack", href: "#stack" },
  { label: "Threats", href: "#threats" },
] as const;

// macOS / Windows download metadata. Replace `href` with the signed-installer
// URLs when builds are uploaded; the UI is shape-stable.
export const DOWNLOADS = {
  mac: {
    label: "Download for Mac",
    sub: "macOS 13+",
    href: "/downloads/Argus.dmg",
  },
  win: {
    label: "Download for Win",
    sub: "Windows 11",
    href: "/downloads/Argus.exe",
  },
} as const;

// -----------------------------------------------------------------------------
// Hero
// -----------------------------------------------------------------------------

export const HERO = {
  marker: { num: "01", label: "Concept" },
  badge: "v0.1 · Mainnet-ready",
  // Two short lines. Together they read as one sentence.
  headline: ["Stop the drainer", "before you sign."],
  // Single-line subhead. Anything longer reads as a paragraph in a hero.
  sub: "A local AI co-pilot for every Solana signature. On-device, always.",
  // Two ornaments — kept minimal; the hero should breathe.
  nodes: [
    {
      pos: "top-[18%] left-[5%]",
      reverse: false,
      icon: Cpu as Icon,
      label: "Local LLM",
      meta: "Qwen3-1.7B · Q4",
      dotClass: "bg-emerald-400/80 shadow-[0_0_8px_rgba(52,211,153,0.8)]",
    },
    {
      pos: "bottom-[22%] right-[5%]",
      reverse: true,
      icon: View as Icon,
      label: "Vision guard",
      meta: "MiniCPM-V 2.6",
      dotClass: "bg-amber-400/80 shadow-[0_0_8px_rgba(251,191,36,0.7)]",
    },
  ],
} as const;

// -----------------------------------------------------------------------------
// Verdict demo (mock cards rendered as visual proof)
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
    title: "Block — visual phishing",
    summary: "Drag-in screenshot mimics Magic Eden at 0.91 similarity.",
    citations: [
      "URL `magic-edenn.io` is one edit from `magiceden.io`.",
      "Vision similarity to canonical Magic Eden: 0.91.",
      "Domain not in allow-list of 47 known dApps.",
    ],
    meta: "Vision · OCR",
  },
  {
    level: "YELLOW",
    title: "Caution — novel authority",
    summary: "Unlimited SPL approval to a program never seen on this wallet.",
    citations: [
      "0 of last 47 transactions match this pattern.",
      "Recipient program deployed 2 days ago.",
      "Highest history similarity 0.29 (Marinade).",
    ],
    meta: "RAG · scam-intel",
  },
  {
    level: "GREEN",
    title: "Approve — Jupiter swap",
    summary: "Routine SOL → USDC, slippage 0.4 %, recipient on history.",
    citations: [
      "Decoded as Jupiter v6 `route` to your wallet.",
      "Simulation: -0.50 SOL, +71.24 USDC.",
      "23 prior swaps to this program in 90 days.",
    ],
    meta: "Simulation · history",
  },
];

// -----------------------------------------------------------------------------
// Why-local
// -----------------------------------------------------------------------------

export const WHY_LOCAL = {
  marker: { num: "02", label: "Why local AI" },
  title: ["The reviewer that doesn't", "leak the transaction."],
  body:
    "Cloud screening sees every signature you'd want it to protect. Argus runs an on-device pipeline so your wallet activity never touches an API.",
  stat: "$2.1B",
  statLabel: "Stolen by Solana drainers in 2024",
} as const;

// -----------------------------------------------------------------------------
// Pipeline cards
// -----------------------------------------------------------------------------

export const PIPELINE_INTRO = {
  marker: { num: "03", label: "Pipeline" },
  title: ["Six on-device models,", "one verdict."],
  body:
    "QVAC's LLM, vision, OCR, embeddings, STT, and TTS, orchestrated as a single review pipeline — every signal grounded by at least one model.",
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
      "Grammar-constrained Qwen3 turns raw instructions into plain English with mandatory citations.",
    variant: "code",
  },
  {
    icon: Connect,
    title: "Cross-reference",
    blurb:
      "Embedded scam-intel, dApp allow-list, and your 100-tx history converge on a single risk score.",
    variant: "orbit",
  },
  {
    icon: FingerPrint,
    title: "Fingerprint the UI",
    blurb:
      "Drag a screenshot in. Vision and OCR catch typo-squat URLs and look-alike phishing kits.",
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
};

export const QVAC_ROWS: QvacRow[] = [
  {
    icon: Sparkles,
    module: "@qvac/llm-llamacpp",
    use: "Plain-English explanation, structured-JSON verdict, allow-list reasoning.",
    path: "ai/explainer.ts",
  },
  {
    icon: View,
    module: "@qvac/llm-llamacpp · vision",
    use: "Screenshot phishing detection; visual similarity to canonical UIs.",
    path: "ai/visionGuard.ts",
  },
  {
    icon: FingerPrint,
    module: "@qvac/embed-llamacpp",
    use: "Embeds scam-intel, history, and incoming descriptors. Cosine outliers.",
    path: "ai/embed.ts",
  },
  {
    icon: FileSearch,
    module: "@qvac/ocr-onnx",
    use: "Extracts text and URLs from Telegram, Discord, and dApp screenshots.",
    path: "ai/ocr.ts",
  },
  {
    icon: Mic,
    module: "@qvac/transcription-whispercpp",
    use: 'Voice-mode "approve" / "block" command transcription.',
    path: "ai/voice.ts",
  },
  {
    icon: VolumeHigh,
    module: "@qvac/tts-onnx",
    use: "Spoken verdict readback for hands-free and accessibility modes.",
    path: "ai/voice.ts",
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
    body: "Transfer to an address that appears in the seed scam-intel corpus.",
  },
  {
    icon: Wallet,
    title: "Unlimited SPL approval",
    body: "`Approve` granting infinite delegate authority to an unknown program.",
  },
  {
    icon: Layers,
    title: "Authority hijack",
    body: "`setAuthority` flipping mint or freeze authority on an account you own.",
  },
  {
    icon: Flash,
    title: "Sandwich-grade slippage",
    body: "Jupiter swap with > 50 % slippage — likely a sandwich or rug.",
  },
  {
    icon: FingerPrint,
    title: "Clipboard-hijack twin",
    body: "Recipient one Levenshtein edit from your own address.",
  },
  {
    icon: View,
    title: "Visual look-alike",
    body: "Screenshot vision similarity > 0.85 to a known phishing kit.",
  },
];

// -----------------------------------------------------------------------------
// CTA + Footer
// -----------------------------------------------------------------------------

export const CTA = {
  title: ["Local intelligence,", "zero exfiltration."],
  body:
    "Install Argus, generate a fresh seed, and review your next signature with six models you fully own.",
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
        { label: "PRD", href: "https://github.com/yourname/Argus/blob/main/prd.md" },
        { label: "Demo video", href: "#" },
        { label: "Architecture", href: "#" },
      ],
    },
    {
      heading: "Built with",
      items: [
        { label: "QVAC SDK", href: "https://qvac.tether.io" },
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
