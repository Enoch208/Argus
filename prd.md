# Argus — Product Requirements Document

**Version:** 0.1 (Hackathon MVP)
**Author:** _[your name]_
**Date:** May 2026
**Status:** Draft → Build
**Target submissions:** Tether QVAC Frontier Side Track ($10k pool) + Solana Frontier Hackathon main pool. Deadline: **May 11, 2026, 23:59 UTC**.
**Repo:** _[github.com/yourname/Argus]_

---

## 1. TL;DR

Argus is a desktop self-custodial Solana wallet that runs a local AI co-pilot in front of every signature. Before any transaction is signed, Argus uses on-device LLM, vision, OCR, embeddings, and speech models — bundled via Tether's QVAC SDK — to explain what the transaction will do, simulate its effect, fingerprint the requesting dApp's UI for phishing patterns, and cross-reference recipients against a local scam-intelligence corpus. Nothing about your wallet activity ever leaves your machine. Tether's WDK provides the underlying Solana key derivation, signing, and broadcast.

The product solves a $2B+/yr problem (Solana wallet drainers) with a moat that only local AI can build: cloud-based transaction-screening services would themselves leak the very signal users are trying to protect. Argus is the canonical proof of why local AI matters.

---

## 2. Problem

Wallet drainers — malicious dApps that trick users into signing transactions which transfer their assets — stole an estimated $2.1B from retail crypto users in 2024 alone. The attack surface is wide: typo-squatted URLs in Telegram and Discord, fake airdrop pages that mimic Magic Eden or Tensor, malicious "free mint" links, and SPL token approval prompts that grant unlimited spend to attacker-controlled programs.

Existing defenses are insufficient on three axes:

The major Solana wallets (Phantom, Solflare, Backpack) display raw account writes and program IDs, which are unintelligible to non-developers. They do flag *some* known-bad addresses, but the lists are sparse, slow to update, and operate on exact matches — they miss freshly deployed drainer programs and visually-cloned phishing UIs.

Browser-based scam-detection extensions (Wallet Guard, Webacy, Pocket Universe) help but require sending every transaction's metadata, the visited URL, and often the wallet address to a centralized API. For a privacy-conscious user, this is the same leak they signed up to crypto to avoid.

Cloud LLM-based transaction explainers — the obvious next-gen idea — are technically possible but commercially nonviable for the privacy-first segment. Sending every transaction you sign to OpenAI is a worse privacy posture than the status quo.

There is a gap for a tool that gives users a sophisticated AI second opinion on every signature *without* leaking that signature to anyone. Local AI is the only architecture that resolves this gap.

---

## 3. Why now

Three independent enabling conditions converged in early 2026:

Tether shipped QVAC publicly on April 9, 2026, providing a turn-key JavaScript SDK for local LLM, vision, OCR, embeddings, STT, and TTS. Before this, local-AI app development required hand-stitching llama.cpp builds for each platform. Now it is `npm install`.

Tether also shipped WDK with a Solana wallet module (`@tetherto/wdk-wallet-solana`), giving any JS developer a production-grade self-custodial wallet primitive without integrating with Phantom or building HD-wallet derivation from scratch.

Consumer hardware crossed the threshold for real-time small-model inference. A 1.7B–3B parameter quantized model now runs at conversational speed on any 2022+ MacBook, modern Snapdragon, or laptop with a half-decent integrated GPU. Vision and OCR models are similarly tractable.

The Solana Frontier hackathon (April 6 – May 11, 2026) creates the catalyst: it has rewarded wallet-security and AI-agent infrastructure projects in every recent edition (Unruggable, Keyless, Agent Arc, Latinum, Hive). The QVAC side track explicitly funds projects that meaningfully integrate local AI. Argus sits at the exact intersection.

---

## 4. Goals & non-goals

### Goals (hackathon scope)

Ship a working desktop application that a judge can install and use end-to-end on their own machine in under five minutes.

Demonstrate meaningful, multi-module use of QVAC — at minimum LLM, vision, OCR, embeddings, and TTS — orchestrated as a single transaction-review pipeline rather than five disconnected demos.

Use WDK for genuine Solana key management, signing, and broadcast on devnet and mainnet.

Produce a reproducible repository (one-command demo scripts, signed installers for macOS and Windows, public GitHub) and a three-minute demo video that lands the "the AI just stopped a drainer in real time" moment.

### Non-goals (hackathon scope)

A browser extension or Phantom plugin. Argus is its own wallet for V1; bridging to existing wallets via WalletConnect is V2.

A mobile app. Web (Electron desktop) only.

Multi-chain support. Solana only for V1.

A backend service or hosted API. Everything runs locally; the only external network calls are to public Solana RPC endpoints and (read-only) the seed scam-intel sources during initial install.

P2P scam-intel federation via Holepunch. Mention as roadmap; do not build.

On-device LoRA fine-tuning of the user's preferences. Mention as roadmap; do not build.

---

## 5. Target users

**Primary persona — "Cautious Anon."** Holds 1–50k USD in SOL, USDC, and a handful of NFTs in a self-custodial wallet. Has been phished or knows someone who has. Reads crypto Twitter, follows ZachXBT. Wants to interact with new dApps but pauses every time the signature prompt appears, knowing they cannot fully read what they are signing. Will pay nothing or a small one-time fee for a tool that materially reduces drainer risk without leaking their wallet.

**Secondary persona — "Power Trader."** Signs 20+ transactions a day across Jupiter, Drift, Kamino, Marinade. Currently relies on muscle memory and trusts the major dApps. Argus must not slow them down on legitimate flows; the safe path needs to be one keypress to approve.

**Tertiary persona — "Accessibility User."** Visually impaired or motor-impaired user attempting self-custody. Existing wallets are largely unusable with screen readers because critical risk information is conveyed through dense unlabeled UI. Argus's voice-mode is designed for this user from the start, not retrofitted.

**Demo persona — "The hackathon judge."** Skeptical, technical, will install the repo on a clean laptop on a Saturday morning. Cares about technical depth, reproducibility, and whether the project would survive contact with a real user. Argus must not require any setup beyond `npm install && npm run demo:phishing`.

---

## 6. User stories

The MVP must support these end-to-end stories. Stories outside the MVP scope are listed under future work.

A new user installs Argus, generates a fresh seed phrase, and sees their public address. The seed is shown once, with a copy-to-clipboard and a "I have stored this offline" confirmation. Argus derives the Solana account using WDK's BIP-44 path and displays the SOL balance.

A user pastes a base58-encoded transaction or scans a Solana Pay QR (out of scope for MVP — paste only). Argus parses the transaction, simulates it against current chain state, decodes the instructions into human-readable form via the local LLM, and presents a verdict card: GREEN (low risk), YELLOW (proceed with caution), or RED (do not sign), with three to five plain-English citations.

A user encounters a suspicious link in Telegram. They take a screenshot of either the message or the dApp's signature prompt and drag it into Argus. OCR extracts URLs and on-screen text; the LLM checks URLs against an allow-list of known-good Solana dApps and flags typo-squats; for screenshots that include the dApp UI, the multimodal model checks visual similarity to known-legitimate dApp UIs and to known phishing kits.

A user holds a keyboard shortcut and says "approve" or "block." Whisper transcribes the command; the verdict is read back via Piper TTS before execution. This same voice mode allows hands-free operation for accessibility users.

A user reviews a transaction that looks unusual. Argus surfaces the explanation: "You have signed 47 transactions on this wallet. None were unlimited token approvals. None named this program. The recipient address shares a cluster with three known drainer wallets last seen in March 2026."

A user approves a transaction. Argus signs via WDK, broadcasts to the configured RPC endpoint, displays the resulting signature with a Solscan link, and writes the transaction (with its plaintext explanation and verdict) to the local history corpus, which feeds the personal RAG index for future comparisons.

---

## 7. Product overview

Argus is a single-window Electron desktop application. The main view is a transaction queue: any transaction the user pastes, drags, or generates internally appears as a card. Each card has a verdict color, a one-sentence summary, an expandable "why" panel with citations, and Approve / Block buttons. A persistent left sidebar shows the user's wallet address, balances, and a search field over their transaction history. A settings panel handles model downloads, RPC endpoint configuration, and the seed-phrase backup status.

The product's defining interaction is the **review modal**. When a transaction enters the queue, the modal expands automatically. The verdict is shown first (large color-coded badge), the plain-English explanation second, and the citations third. The user makes a binary decision; everything else is justification for that decision.

The visual language is deliberately serious — high-contrast, monospace for hex/addresses, no emoji, restrained color. Argus is a security tool, and the UI should signal that it has read the transaction more carefully than the user could have.

---

## 8. Functional requirements

### 8.1 P0 — must ship for the hackathon submission

| ID | Requirement | Acceptance criteria |
|---|---|---|
| F-01 | Wallet creation via WDK | New seed phrase generated; public address derived correctly; balance fetched from RPC |
| F-02 | Wallet import via WDK | 12/24-word seed phrase restores the same address |
| F-03 | Paste-to-review for raw transactions | Base58 transaction string parses; instructions decoded; simulation runs and surfaces balance deltas |
| F-04 | LLM-generated plain-English explanation | Local LLM produces structured JSON verdict (risk level, summary, 3+ citations) within 10 seconds on reference hardware |
| F-05 | Scam-intel lookup | Recipient addresses, mints, and program IDs are checked against a pre-shipped local SQLite + vector index; matches surface as citations |
| F-06 | Personal-history RAG | User's last 100 transactions are embedded; new transactions are compared by cosine similarity; outliers are flagged |
| F-07 | Screenshot OCR + URL allow-list | User drags an image; OCR extracts text; URLs are tested against a curated allow-list of legitimate Solana dApps |
| F-08 | Vision-based dApp UI fingerprinting | Multimodal LLM compares a screenshotted dApp UI against a small library of canonical legitimate UIs and known phishing kits; returns similarity scores |
| F-09 | Voice approval mode | Keyboard shortcut activates Whisper STT; "approve" or "block" command is recognized and acted on; verdict is read aloud via TTS |
| F-10 | Sign and broadcast | Approved transaction is signed by WDK and broadcast to the configured RPC endpoint; resulting signature shown with Solscan link |
| F-11 | Local history persistence | Every reviewed transaction (with its verdict and explanation) is written to local SQLite and indexed for future RAG |
| F-12 | Pre-loaded demo scenarios | Three npm scripts (`demo:phishing`, `demo:safe`, `demo:approve`) load canned transaction scenarios with deterministic outcomes for judge replay |

### 8.2 P1 — ship if time remains after Day 9

A search bar over the local history corpus that allows the user to ask natural-language questions ("what did I approve to Magic Eden last month") via on-device RAG.

A "second opinion" mode where the user can paste a screenshot of a Telegram message into Argus without any transaction context, and Argus returns a risk assessment based purely on the visual + textual content.

Solana Pay QR code scanning (via `qr-scanner` library on the renderer side) so users can review mobile-originated transactions on their desktop.

A simple settings toggle for "verbose" mode that surfaces the full instruction-by-instruction breakdown for power users.

### 8.3 P2 — explicitly out of scope, mention only as roadmap

Browser extension or WalletConnect peer mode ("Argus Connect") so any dApp or existing wallet can route transactions through Argus for review.

P2P federated scam-intel updates over Holepunch / Hyperdrive, so the community's collective drainer-spotting strengthens every node.

On-device LoRA fine-tuning that personalizes verdicts based on the user's approve/block history without any data leaving the machine.

Multi-chain support beyond Solana (Bitcoin, Ethereum, Tron via WDK's other wallet modules).

A mobile companion app that uses QVAC's Expo runtime, with delegated inference back to the desktop instance via pear:// peer links.

---

## 9. Non-functional requirements

The cold-start time from app launch to the first ready-to-review transaction must be under 8 seconds on reference hardware (Apple M2, 16 GB RAM) once models are downloaded.

LLM verdict generation must complete within 10 seconds on reference hardware. Vision verdict within 15 seconds. OCR within 5 seconds. STT within 3 seconds for utterances under 5 seconds long.

The total bundled download size must stay below 4.5 GB across all models. Models are downloaded on first launch with clear progress UX, not bundled into the installer.

Argus must function with no internet connectivity *after* models are downloaded, with the single exception of the configured Solana RPC endpoint for chain reads and broadcasts. All AI operations must run with airplane mode on; verify this before submission.

The application must run on macOS 13+ (Apple Silicon and Intel) and Windows 11. Linux is best-effort. Mobile is out of scope.

The codebase must compile and run from a fresh `git clone && npm install && npm run dev` on the reference platforms with no manual configuration. This is non-negotiable for the hackathon's reproducibility criterion.

The repository must include a clear architecture diagram, a README with screenshots, and the official "Built with QVAC" badge.

---

## 10. Technical architecture

Argus runs as an Electron desktop application with three logical processes that communicate via IPC.

The **renderer process** is a React 18 + Vite + TypeScript SPA styled with Tailwind and shadcn/ui. It owns all UI state via Zustand. It does not directly access the wallet or the AI models — it sends intent messages over IPC and renders state updates.

The **Electron main process** owns the wallet lifecycle (via `@tetherto/wdk-wallet-solana`), the Solana RPC client (via `@solana/web3.js`), and the local SQLite database (via `better-sqlite3` with the `sqlite-vss` extension for vector search). It receives intent messages from the renderer, orchestrates the AI pipeline, writes results to the database, and pushes UI updates back.

The **QVAC service** is a Bare or Node child process running the `@qvac/cli serve` command, which exposes an OpenAI-compatible HTTP server on `127.0.0.1:<random-port>` for chat completions, embeddings, and tool-calling, plus dedicated endpoints for OCR, vision, STT, and TTS via the addon-specific APIs. The main process owns the lifecycle of this service and proxies all AI calls to it.

Models are stored in the user's application data directory under `~/Library/Application Support/Argus/models/` (macOS) or the platform equivalent. First launch triggers a download wizard that pulls each model from a CDN (with Tether's `pear://` URL listed as the future P2P alternative). Cached models are reused across launches.

The local database has four tables. `transactions` stores every reviewed transaction with its raw bytes, decoded form, verdict, explanation, and outcome. `scam_intel` stores the seed corpus of known-bad addresses, programs, and mints, with embeddings for semantic match. `dapp_fingerprints` stores canonical screenshots and embeddings of legitimate dApp UIs for visual similarity comparison. `settings` stores user preferences and wallet metadata (encrypted seed under a user-set passphrase).

External dependencies are deliberately minimal. Only the Solana RPC endpoint is required at runtime; everything else is local.

---

## 11. QVAC module integration matrix

This matrix exists for one reason: the technical-depth criterion is 40% of the QVAC side track judging weight. A judge skimming the README must be able to verify in 30 seconds that Argus uses QVAC meaningfully across multiple modalities.

| QVAC module | What Argus uses it for | Where in the codebase |
|---|---|---|
| `@qvac/llm-llamacpp` (text) | Plain-English transaction explanation; structured-JSON verdict generation; URL-allow-list reasoning | `src/main/ai/explainer.ts` |
| `@qvac/llm-llamacpp` (multimodal vision) | dApp UI phishing detection from screenshots; visual similarity scoring against known kits | `src/main/ai/visionGuard.ts` |
| `@qvac/embed-llamacpp` | Semantic embedding of scam-intel entries, user transaction history, and incoming transaction descriptors; cosine-similarity outlier detection | `src/main/ai/embed.ts`, `src/main/db/vectors.ts` |
| `@qvac/ocr-onnx` | Extract text and URLs from screenshots of Telegram, Discord, and dApp prompts | `src/main/ai/ocr.ts` |
| `@qvac/transcription-whispercpp` | Voice-mode "approve" / "block" command transcription | `src/main/ai/voice.ts` |
| `@qvac/tts-onnx` | Spoken verdict readback for hands-free and accessibility modes | `src/main/ai/voice.ts` |

Six modules. One pipeline. Each one's output feeds either the verdict or its citations. The README will include a system-flow diagram that traces a single transaction through every module.

WDK is not a QVAC module but is used pervasively for wallet operations, satisfying the Solana-native requirement of the Frontier main track. The integration is documented separately in the README.

---

## 12. Critical user flows

### Flow A — First launch

The user opens Argus. A welcome screen offers "Create new wallet" or "Import existing." On selecting create, WDK generates a 12-word mnemonic which is shown once with mandatory checkbox confirmation. The wallet derives the Solana address. The user is prompted to download models (~3.8 GB total) with per-model progress bars and an estimated time remaining. Once complete, the main UI loads, balances are fetched, and the queue is empty.

### Flow B — Reviewing a paste-in transaction

The user copies a base58 transaction from a dApp's "advanced" panel and pastes it into Argus's input field. Within 200ms, Argus parses and decodes; within 2s, simulation completes; within 10s, the LLM verdict arrives. The verdict card animates in with a colored badge, the one-line summary, and the citations. The user clicks "Why?" to expand the full explanation. They press Approve. Argus signs via WDK, broadcasts, shows the signature, and the card moves to history.

### Flow C — Screenshot phishing detection

The user pastes a screenshot of a suspicious "free Magic Eden mint" page directly into Argus (Cmd+V works on the main window). OCR runs in parallel with vision: OCR extracts the URL `magic-edenn.io` and the visible text; the multimodal LLM compares the screenshot's layout to canonical Magic Eden screenshots and returns a 0.91 similarity score; the URL allow-list flags the typo-squat. The card is RED. Citations: "URL `magic-edenn.io` is one character from `magiceden.io`," "Visual layout matches Magic Eden at 0.91 similarity," "Domain not in allow-list of 47 known Solana dApps." The user does not visit the link.

### Flow D — Voice mode

The user is reviewing a transaction one-handed. They press and hold the F5 key. Argus plays a soft chime (audible cue) and Whisper begins listening. The user says "approve." Whisper transcribes; the LLM verdict is read back via Piper: "Verdict green: SOL transfer of 0.5 to a previously-used recipient. Approving." The transaction is signed.

### Flow E — Outlier detection from history

The user signs 47 normal transactions over a week. On day 8, a new transaction arrives that grants unlimited approval to a never-seen-before program. The personal-history embedding distance to the user's "normal" is 0.71 (high). This becomes a citation: "You have signed 47 transactions; none of the closest 5 match this pattern. Highest similarity: 0.29 to a Marinade stake from April 30." The verdict is YELLOW even though no scam-intel rule fires. The user pauses, double-checks externally, blocks.

---

## 13. UX principles

**The verdict comes first.** A user under attack does not have time to read paragraphs. The colored badge and one-line summary must be readable in under one second. Everything else is for those who want to dig in.

**Citations are mandatory.** No verdict appears without at least one cited reason. The LLM's confidence is meaningless without grounding; users learn to trust the system because they can see *why* each decision was made.

**Honest uncertainty.** When the system is not sure (e.g., visual similarity 0.6, no scam-intel match, no historical comparison), the verdict is YELLOW with the explicit reason "this transaction is novel; we cannot confirm safety from local signals alone." Argus must never overclaim certainty on either side.

**No dark patterns.** The Approve and Block buttons are equally prominent. There is no countdown timer pressuring the user. The default action when in doubt is no action.

**Accessibility from the start.** All verdict information is exposed to screen readers via ARIA. Voice mode is not a feature flag; it's a first-class entry point with a visible activation key.

---

## 14. Risk assessment

The largest technical risk is multimodal vision-model accuracy on dApp UI fingerprinting. A 7B-class vision model is good but not perfect at "does this look like Magic Eden." Mitigation: scope the canonical library to the top 10 Solana dApps; treat visual similarity as one citation among many, not the sole verdict driver; acknowledge in the demo that this signal is probabilistic.

The second risk is small-LLM tool-calling reliability for the structured verdict JSON. A 1.7B–3B model under stress may produce malformed JSON. Mitigation: use llama.cpp's GBNF grammar-constrained decoding so the schema is enforced at the token level. This is a documented QVAC feature; budget half a day to wire it correctly.

The third risk is model download size and first-run time. ~4 GB on a hotel wifi connection takes 20+ minutes and a judge will close the tab. Mitigation: ship a `--demo-mode` flag in the installer that downloads only the smallest viable models (Qwen3-1.7B Q4, Whisper-tiny.en, Piper-low, MiniCPM-V-2.6 Q4 for vision, MiniLM for embeddings, PaddleOCR-mobile) bringing the footprint under 2.5 GB. Reserve the higher-quality models for a "production" toggle.

The fourth risk is scam-intel data freshness. The seed corpus scraped from GoPlus, RugCheck, SolanaFM, and Phantom's open scam-list is a snapshot; new drainers ship daily. Mitigation: be honest about this in the demo and in the README. Pitch P2P updates via Holepunch as the V2 roadmap and frame it as the natural extension of the local-first architecture.

The fifth risk is wallet UX edge cases (network errors, RPC timeouts, simulation failures on complex transactions). Mitigation: every error state has a clear, user-readable explanation; never silently fail; never let a transaction be signed if simulation could not complete.

The sixth risk is judge-laptop reproducibility. Mitigation: test the full install flow on a clean macOS VM and a clean Windows 11 VM 48 hours before submission. If `git clone && npm install && npm run demo:phishing` does not work first try, the demo will fail.

---

## 15. Success metrics

### Hackathon success (binary)

Submitted to both the Tether QVAC Superteam Earn listing and the Colosseum Frontier portal before May 11, 2026 23:59 UTC. Public GitHub repo with all commits dated within the hackathon window. Three-minute demo video published on YouTube. Pitch deck submitted.

### Hackathon success (graded)

Top-3 finish in the QVAC side track ($2k–$5k prize). Stretch goal: a $10k Frontier startup-prize award. Reach goal: selection for the Colosseum accelerator's $250k pre-seed cohort.

### Product success (post-hackathon, if pursued)

100 weekly active users within 30 days of public release. At least one independently-reported drainer save in the wild (a user posts on X "Argus stopped this drainer for me"). 50+ GitHub stars within 14 days of submission.

---

## 16. Build milestones

Eleven calendar days, May 1 – May 11. Targets are end-of-day commits.

**Day 1 (May 1):** Electron + Vite + React + TS scaffold compiles. QVAC HTTP server reachable from main process, "hello world" round-trips through Qwen3-1.7B. WDK generates a Solana keypair and shows the address.

**Day 2 (May 2):** Paste-to-parse transaction flow works end-to-end on devnet for the canonical instruction set (SOL transfer, USDC transfer, SPL approve, Jupiter swap, Magic Eden listing, setAuthority, unknown-program call). Simulation runs and surfaces balance deltas.

**Day 3 (May 3):** LLM explainer produces a structured JSON verdict for all 10 canonical transactions, with grammar-constrained decoding enforcing the schema. Verdict card UI renders.

**Day 4 (May 4):** Scam-intel seed corpus scraped, embedded, indexed. Address/program/mint lookups work. Citations appear in verdict cards.

**Day 5 (May 5):** Personal transaction history is fetched on first run, embedded, and used for outlier detection. New citations appear when a transaction is novel.

**Day 6 (May 6):** Vision pipeline wires up. Drag-screenshot-into-app works. Multimodal LLM returns visual similarity to canonical dApp library. New citation source live.

**Day 7 (May 7):** OCR pipeline wires up. URL allow-list logic works. Typo-squat detection produces high-confidence citations.

**Day 8 (May 8):** Voice mode works end-to-end. F5 hold engages Whisper; "approve" / "block" act on the active card; Piper reads the verdict back.

**Day 9 (May 9):** Sign-and-send via WDK works on devnet and mainnet. History persistence writes correctly. Full feature freeze. Begin polish pass.

**Day 10 (May 10):** Reproducibility scripts (`demo:phishing`, `demo:safe`, `demo:approve`) work from a clean clone. Installer builds for macOS and Windows. README written with architecture diagram and "Built with QVAC" badge. Test on a clean VM.

**Day 11 (May 11):** Demo video recorded, edited, uploaded. Pitch deck completed. Final mainnet rehearsal with $1. Submit to QVAC Superteam Earn and Colosseum Frontier portal. Post launch thread on X.

---

## 17. Out of scope (explicit)

Multi-chain wallet support. Mobile app. Browser extension or WalletConnect peer mode. Federated P2P scam-intel. On-device LoRA personalization. Hardware-wallet integration. Multi-signature support. Custom RPC endpoint marketplace. Token swap routing within Argus. Portfolio analytics. NFT viewer beyond the wallet's basic balance display. Any non-Solana QVAC application.

These are not bad ideas; they are V2+ ideas. Including them in V1 guarantees missing the May 11 deadline.

---

## 18. Open questions

Should the demo target devnet (safer, but less impressive on stage) or mainnet (riskier, but the live Solscan link is unforgettable)? Current lean: mainnet, with a $1 transaction.

Should Argus ship its own model-distribution CDN, rely on Tether's `pear://` peer network, or both? Current lean: HTTPS CDN for V1 reliability; mention `pear://` as roadmap.

Should the seed phrase be encrypted with a user-set passphrase or stored in OS keychain? Current lean: user-set passphrase for V1 (broader compatibility); OS keychain integration for V2.

How aggressive should the YELLOW threshold be? A trigger-happy system trains users to ignore warnings; a too-permissive one misses the very threats Argus exists to catch. Plan to tune empirically across the 10 canonical transactions during Day 4–5.

---

## Appendix A — Threat catalog

The MVP must demonstrate detection of these specific drainer patterns. Each is encoded as a deterministic test fixture in `test/fixtures/`.

A SOL transfer to a recipient address that appears in the seed scam-intel corpus.

An SPL token approval (instruction `Approve` or `ApproveChecked`) granting unlimited delegate authority to a program ID not present in the user's history and not in the dApp allow-list.

A `setAuthority` instruction that changes the mint authority or freeze authority of a token account the user owns.

A Jupiter swap with a slippage greater than 50% (likely a sandwich attack or rug pull).

A transaction whose recipient is one Levenshtein edit away from the user's own address (clipboard-hijacking).

A transaction whose calldata calls a Token-2022 program with a transfer hook that points to an unknown program.

A transaction signed in response to an OCR'd screenshot containing a URL that is one character from a known dApp.

A transaction signed in response to a screenshot whose multimodal vision similarity to a known phishing kit exceeds 0.85.

---

## Appendix B — Tech stack inventory

Frontend: React 18, Vite, TypeScript, TailwindCSS, shadcn/ui, Zustand, Lucide icons.

Electron: electron, electron-vite, electron-builder for distribution.

Solana: @solana/web3.js, @tetherto/wdk-wallet-solana, @tetherto/wdk-account.

QVAC: @qvac/sdk, @qvac/llm-llamacpp, @qvac/embed-llamacpp, @qvac/transcription-whispercpp, @qvac/tts-onnx, @qvac/ocr-onnx, @qvac/cli (for the local HTTP server pattern).

Database: better-sqlite3 with sqlite-vss extension for vector search.

Models: Qwen3-1.7B-Instruct Q4 (text LLM), MiniCPM-V-2.6 Q4 (vision), Whisper-base.en (STT), Piper-medium-en (TTS), PaddleOCR-mobile (OCR), bge-small-en-v1.5 (embeddings). Combined ~3.8 GB.

Scam-intel sources (one-time scrape on Day 4): GoPlus Solana API, RugCheck, SolanaFM blacklist, Phantom's open scam-list repo, Webacy public feed, Solscan abused-tokens list.

---

## Appendix C — Demo video script reference

Three minutes. Six beats. The full beat-by-beat script lives in `docs/demo-script.md` and is locked on Day 10. Beat outline:

0:00–0:15 — Hook: "$2.1B in drainer losses in 2024. Phantom can't see this coming. Cloud AI can — but at the cost of leaking every transaction. Argus can. Locally."

0:15–0:45 — The threat: a real-feeling Telegram message, a fake Magic Eden mint page, a signature prompt.

0:45–1:30 — The save: review modal pops, RED verdict, three citations, voice mode reads "block."

1:30–2:00 — The architecture: diagram on screen, voice-over names the six QVAC modules + WDK; emphasize "no data left this device."

2:00–2:30 — The legitimate path: a real Jupiter swap, GREEN verdict, mainnet broadcast, Solscan link.

2:30–3:00 — The vision: standalone wallet today, Argus Connect tomorrow, security primitive embedded by every Solana app the day after. Built with QVAC. End card with GitHub URL.

---

_End of PRD v0.1. Update this document as scope changes. Tag the PRD version in every commit message that materially deviates from it._