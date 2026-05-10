# ADR-0006: Bundled manifest v1, signed manifest v2

**Status:** Accepted · 2026-05-10

## Context

Argus's first-launch downloader fetches ~3 GB of models from a CDN. Per
[SECURITY.md §model integrity](../SECURITY.md), every file is sha-256 verified
against an expected hash, and the manifest itself should be Ed25519-signed
against a pubkey bundled with the app. Two questions: where does the manifest
live, and how do we validate it for v1?

## Decision

**v1 (this release):** the manifest ships **bundled** with the app at
`resources/manifest.json` and is parsed via the zod schema in
`shared/types/manifest.ts`. The `signature` field is `null`. sha256 entries
MAY be `null` — the downloader logs a warning and proceeds (size + URL are
still validated). The pre-commit hook ensures no `signature: null` and no
`null` sha256 ships in a tagged release once v2 lands.

**v2 (post-hackathon):** manifest moves to Cloudflare R2 with a stable URL.
The app fetches v2 at first run, falls back to the bundled v1 if offline.
Every entry has a real sha256. The manifest is Ed25519-signed; the public key
is bundled with the app at `resources/manifest.pubkey`. Verification is
mandatory in v2 — a manifest that fails signature or whose URL host isn't on
the manifest's own `allowedHosts` is refused.

## Consequences

### What we get from v1

- Zero infrastructure dependency. The hackathon-day install path is fully
  reproducible: `git clone && npm install && npm run dev` produces a working
  downloader, no network setup required.
- The full code path (manifest parse → host allowlist → resumable download →
  size verify → optional sha verify → atomic rename) ships and is exercised
  end-to-end. Adding signing is a small follow-up.

### What we accept from v1

- Manifest can't be updated without an app release. Fine for the hackathon;
  unacceptable post-launch — hence v2.
- sha256 = null means a CDN compromise that swaps a model file would slip
  through the size check (sizes can be made to match). Mitigation: every
  release before v2 lists this as a known risk in the release notes; users
  who care can compute the hash and patch the manifest locally.

### Why not Cloudflare R2 + signing for v1

- Signing requires a keypair. We don't yet have a CI-safe signing flow. Doing
  it under hackathon time pressure is the way to ship a signing flow that
  leaks the private key.
- R2 hosting requires creating the bucket, uploading the manifest, and
  shipping the URL. Trivial work, but every external infrastructure step is
  another moving part to debug under deadline.
- v1's bundled-and-tolerant approach exercises the same code paths v2 will
  use; switching is a content change, not a code change.

## Revisit when

- Day 1 after the hackathon submission. v2 is the first follow-up task.
- Sooner if a real attacker scenario forces it (unlikely pre-launch, by
  definition).
