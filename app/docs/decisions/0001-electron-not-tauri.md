# ADR-0001: Electron over Tauri

**Status:** Accepted · 2026-05-10
**Deciders:** project lead
**Supersedes:** —

## Context

Argus is a desktop self-custodial Solana wallet that runs on macOS and Windows. We need a cross-platform shell. The two realistic options are **Electron** and **Tauri 2**.

Argus's hard dependencies are:

- `@tetherto/wdk-wallet-solana` — TypeScript / Node JS.
- `@qvac/sdk`, `@qvac/cli serve` — TypeScript wrapping native llama.cpp / whisper.cpp / ONNX addons; designed to run as a Node child process.
- `better-sqlite3` + `sqlite-vss` — Node native module.
- Six on-device models totalling ~3.8 GB downloaded on first run.

## Decision

We use **Electron**, scaffolded with `electron-vite` and packaged with `electron-builder`.

## Consequences

### What we get

- Direct, in-process integration with WDK and `better-sqlite3`. No sidecar binaries to ship per platform, no Node binary to bundle separately for Tauri.
- `electron-builder` produces signed `.dmg` (notarized) and `.exe` (NSIS) from one config file.
- `electron-updater` for auto-update with Ed25519-signed releases.
- Mature ecosystem: VS Code, Linear, Notion, Slack, Figma, 1Password are all Electron — proves a self-custodial wallet can be built on it without compromising on polish.

### What we give up

- Installer size (~120 MB vs Tauri's ~10 MB). Acceptable: the user already has to download ~3 GB of models, so the installer is not the dominant download.
- Memory baseline (~150 MB idle vs Tauri's ~50 MB). Acceptable on a laptop running a 1.7B-parameter LLM.
- Rust safety. Tauri's Rust core is harder to compromise than Chromium. Mitigation: aggressive process isolation (`nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`), strict CSP, all decisions in [SECURITY.md](../SECURITY.md).

### Why Tauri was rejected

- QVAC and WDK are JS / Node. Running them under Tauri requires a Node sidecar binary that we ship and update across platforms. With an 11-day hackathon timeline this is a category of integration debt that quietly eats deadlines.
- `better-sqlite3` becomes either `tauri-plugin-sql` (less control) or a hand-rolled Rust ↔ JS bridge (a project of its own).
- The "10 MB installer" advantage is irrelevant once we hit the model download.

## Revisit when

- Electron's process model fundamentally changes (e.g., Node integration removed).
- A wallet-grade Tauri ecosystem emerges (a WDK port to Rust would be the trigger).
- Argus ships on a platform Electron doesn't support (a mobile target — but PRD §4 explicitly excludes mobile from V1).
