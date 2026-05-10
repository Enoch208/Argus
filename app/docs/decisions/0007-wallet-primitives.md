# ADR-0007: WDK for wallet primitives, Argon2id for keystore

**Status:** Accepted · 2026-05-10

## Context

[PRD §10](../../../prd.md) and [SECURITY.md §The seed phrase](../SECURITY.md)
specify the wallet must:

- Generate a BIP-39 12-word seed phrase, stored encrypted at rest under a
  user-set passphrase using Argon2id (default RFC cost params).
- Derive the Solana account using BIP-44 path `m/44'/501'/0'/0'`.
- Sign and broadcast inside the main process — the seed never crosses IPC,
  never serialises into a log line, never appears in a stack trace.

Two questions: which library generates / derives, and how do we encrypt the
seed at rest.

## Decision

### Primitives — `@tetherto/wdk-wallet-solana` (beta)

We use Tether's WDK (`@tetherto/wdk-wallet-solana@1.0.0-beta.8`). Reasons:

- It's the wallet library the [PRD](../../../prd.md) prescribes (it's what
  the QVAC side track expects to see used). Using it satisfies the Solana
  Frontier track's "WDK integration" criterion in one install.
- Implemented by Tether's Holepunch team (mafintosh), Apache 2.0 licensed,
  publicly available on npm.
- Internally uses `bip39`, `micro-key-producer`, `sodium-universal` — the
  vetted implementations of the standards we'd otherwise reach for. Adopting
  WDK gives us those one level up.
- Exposes a `WalletManagerSolana` with `getAccount(index)` returning a
  `WalletAccountSolana` that signs and broadcasts. Surface fits our needs
  exactly — main process owns the manager, renderer never touches it.

### Encryption at rest — `@node-rs/argon2`

For the keystore that wraps the seed, we use `@node-rs/argon2` (Rust binding
via napi-rs). Reasons:

- Argon2id is the [RFC 9106](https://www.rfc-editor.org/rfc/rfc9106.html)
  recommended KDF for password-derived keys. Mandated by [SECURITY.md](../SECURITY.md).
- `@node-rs/argon2` ships prebuilt binaries for macOS / Windows / Linux. No
  node-gyp build step (avoids the `better-sqlite3` build-time pain).
- Maintained by the napi-rs project; pure Rust under the hood, audited.

Encrypted blob layout:

```
keystore.json
{
  "version": 1,
  "argon2": { "memoryCost": 65536, "timeCost": 3, "parallelism": 4, "salt": "<base64>" },
  "ciphertext": "<base64>",   // AES-256-GCM
  "iv": "<base64>",
  "authTag": "<base64>"
}
```

The Argon2id output (32 bytes) is the AES-256-GCM key. Plaintext is the
BIP-39 mnemonic UTF-8 bytes. We zero the derived key buffer + plaintext
buffer immediately after signing operations.

## Consequences

### What we get

- One `npm install` puts the wallet primitives in place. No bespoke BIP-44
  derivation code on our side to audit.
- WDK integrates with the same Solana RPC client used elsewhere. One
  Connection, one allowlist.
- Argon2id + AES-GCM is the standard at-rest pattern; reviewers know it.

### What we accept

- WDK is `1.0.0-beta.X`. APIs may shift before `1.0.0`. Mitigation: pin the
  exact version in `package.json` (no caret), and review the WDK release
  notes before bumping.
- WDK depends on `bare-node-runtime`. In Electron's main process this loads
  fine (Bare's surface overlaps Node's), but if the dev/prod path diverges
  we'll see it early — flagged as a known watch-item.

### What's out of scope for this slice

- OS-keychain integration (macOS Keychain / Windows Credential Manager) as a
  passphrase store — V2 (mentioned in [PRD §18](../../../prd.md)). For V1,
  the user types the passphrase on every unlock.
- Hardware-wallet integration. V2.
- Multi-account or HD-tree management beyond `m/44'/501'/0'/0'`. V2.

## Revisit when

- WDK ships a stable `1.0.0`. Drop the pin to `^1.0.0`, retest the integration.
- An OS-keychain story is worth building (probably right after the
  hackathon).
