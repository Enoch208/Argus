# Security

This is a wallet. The default posture is paranoid. If a rule below feels excessive, the rule is right and your instinct is wrong.

## The threat model

Argus's adversaries are:

1. **A malicious dApp** that crafts a transaction designed to look benign and drain assets.
2. **A malicious page or message** that tricks the user into pasting a hostile transaction or screenshot.
3. **A malicious npm dependency** that tries to read the keystore, exfiltrate the seed, or alter the verdict.
4. **A compromised model file** swapped at rest by malware on the user's disk.
5. **A passive network observer** trying to correlate which transactions the user reviews.

For each, the rules below are the defence.

## Hard rules

### Process isolation (defends 1, 3)

```ts
new BrowserWindow({
  webPreferences: {
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: true,
    preload: <one preload script>,
  },
})
```

Non-negotiable. The renderer has no `require`, no Node globals, no filesystem, no `process`. The preload exposes exactly one typed object via `contextBridge.exposeInMainWorld('argus', api)`.

A renderer-process supply-chain compromise (a malicious npm in the renderer bundle) can call only `window.argus.*` channels. It cannot read disk. It cannot reach the keystore. It cannot read environment variables. It cannot open arbitrary network connections (CSP).

### Content Security Policy (defends 2, 3)

The renderer's CSP allows:

- `default-src 'self'` for everything.
- `script-src 'self'` only — no inline, no remote, no `eval`, no `new Function`.
- `connect-src 'self'` plus the configured Solana RPC URL — nothing else.
- `img-src 'self' data: blob:` — the user's own pasted screenshots.
- `font-src 'self'` — fonts are bundled.
- No `unsafe-inline`, no `unsafe-eval`, ever.

This blocks the entire class of attacks where a compromised script tries to phone home.

### The seed phrase (defends 1, 3, 4)

- Stored on disk encrypted with a user-set passphrase using a vetted KDF (Argon2id, default cost parameters from the RFC).
- Decrypted only inside the main process, only into a buffer that is zeroed after use.
- Never serialized to a log line. The logger has a redactor that drops anything matching seed-phrase shape (12 or 24 BIP-39 words separated by single spaces).
- Never crosses IPC. The renderer cannot ask for it. The preload exposes no channel that returns it. The only export from main is the public address.
- Never written to a stack trace. Errors that cross IPC are normalised to `{ code, message }` — no `stack`, no `cause`.

If a code review finds any path where the seed could leak, that PR is rejected without further comment.

### Model integrity (defends 4)

Every model file has a `sha256` in the signed `manifest.json`.

- Manifest URL is hard-coded into the binary. It is fetched over HTTPS with certificate pinning (configured CA list, not the OS root store) at first run.
- Manifest is verified by signature (Ed25519 against a public key bundled with the app).
- Each model file is downloaded, then SHA-verified, then renamed to its final path. A mismatch deletes the partial and refuses to load.
- Models are mmap-loaded read-only. A model file modified at rest after install fails verification on next launch.

### Network (defends 5)

At runtime, after first-run setup, the only outbound connections allowed are to:

- The user-configured Solana RPC endpoint.

That is the entire allowlist. Telemetry is forbidden. Crash reporting is forbidden. "Anonymous usage metrics" are forbidden. The privacy claim is load-bearing for the product.

This must be enforced at two layers:

1. CSP (renderer can't make other connections).
2. Main-process guard: an HTTP client wrapper that rejects any URL not on the allowlist.

### IPC validation (defends 1, 3)

The main process does not trust the renderer.

Every channel handler:

```ts
ipcMain.handle("review.start", async (_e, raw) => {
  const input = ReviewStartInput.parse(raw); // zod, throws on bad input
  // ... safe to use input now ...
});
```

Validation is at every channel, not "at the front door." A renderer that's been compromised should not be able to bypass validation by going directly to a deeper channel — there is no deeper channel.

### Window features (defends 1, 2)

```ts
win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
win.webContents.on("will-navigate", (e, url) => {
  if (!isInternal(url)) e.preventDefault();
});
```

No external URLs open in the app's webview. Anything the user clicks that goes off-app opens in their default browser via `shell.openExternal` (which itself URL-allow-lists `https://*` only).

### Native dependencies

Every native module gets an ADR before adding. Argus depends on:

- `better-sqlite3` (filesystem DB).
- The QVAC native addons (loaded out-of-process by `@qvac/cli serve`).

That is the entire native surface. Anything else is in the renderer's sandbox.

### Logging

Use `electron-log`. Configure:

- Redactor: drops 12/24-word BIP-39 sequences, base58 strings ≥ 32 chars, base64 strings ≥ 64 chars.
- File rotation: 5 × 1 MB.
- `console.*` is forbidden in production builds (stripped by build config).

If you find yourself wanting to log a transaction's raw bytes "to debug," log the SHA-256 of the bytes instead.

### Auto-update

`electron-updater`, signed by the same Ed25519 key as the manifest. Updates are checked over HTTPS-pinned, never auto-installed without user confirmation, and verified by signature before apply.

## What you must do before merging anything

A change to any of: `main/wallet/**`, `main/db/**`, `main/ai/**`, `preload/**`, `shared/ipc.ts`, the CSP, the network allowlist, the manifest verification, or the auto-update path triggers a **mandatory security review**. No exceptions, no shortcuts.

## What you must never do

- `eval`, `new Function`, `setTimeout(string, …)`. The CSP forbids it; don't try to work around the CSP.
- Read or write to a path outside `app.getPath('userData')` without an explicit reason in code review.
- Add a remote script tag, a remote stylesheet, or a remote font.
- Disable any of `nodeIntegration`, `contextIsolation`, `sandbox`.
- Pass anything from the renderer into a shell command, a path, or a SQL string concatenation.
- Catch a security-relevant exception and continue. Throw, log the redacted form, and let the user retry.
