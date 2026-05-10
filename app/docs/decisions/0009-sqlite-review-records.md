# ADR-0009: SQLite for review records, sign-and-broadcast via WDK

**Status:** Accepted · 2026-05-10

## Context

The renderer now expects three persistence-backed surfaces:

- `review.queue` — pending review records.
- `review.history` — signed and blocked records.
- `review.search` — natural-language LIKE over both.

And a real `review.approve` that signs + broadcasts the transaction. The
renderer also expects `Verdict.explanation` populated with a structured
`{source, status, title, plainEnglish, risks, recommendation, model}` shape
so the future QVAC LLM swap is a content change, not a contract change.

## Decision

### Persistence — `better-sqlite3` v12

We re-introduce `better-sqlite3` (deferred from
[ADR-0001](0001-electron-not-tauri.md)). v12 ships pre-built binaries for
Node 22+ and Electron's bundled Node, sidestepping the node-gyp pain that
killed v11 on Node 24 in our first attempt.

The repo lives at `main/review/store.ts` — domain ownership, not generic
infrastructure (per [STRUCTURE.md §Anti-patterns](../STRUCTURE.md), no
`db/` junk-drawer). Future domains keep their own `<domain>/store.ts`.

Schema is **one table** for v1 — `review_records`:

```sql
CREATE TABLE IF NOT EXISTS review_records (
  id          TEXT PRIMARY KEY,
  status      TEXT NOT NULL CHECK (status IN ('pending', 'signed', 'blocked')),
  verdict     TEXT NOT NULL,        -- JSON of the full Verdict envelope
  signature   TEXT,                  -- broadcast tx signature, NULL until signed
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  -- search support: a flat text index of summary + citation text
  search_text TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_review_records_status ON review_records(status);
CREATE INDEX IF NOT EXISTS idx_review_records_created ON review_records(created_at DESC);
```

`search_text` is the concatenation of `verdict.summary`, `verdict.citations`,
and each instruction's `summary`. Search is `LIKE '%query%' COLLATE NOCASE`
for v1 — vector search via `sqlite-vss` lands when the embeddings model is
wired (next slice with QVAC).

### Sign + broadcast — WDK + web3.js Keypair

WDK's `WalletAccountSolana` exposes `keyPair: { publicKey, privateKey }`
where `privateKey` is the 32-byte Ed25519 seed. We construct an
`@solana/web3.js` `Keypair.fromSeed(seed)`, partial-sign the parsed
transaction, and `Connection.sendRawTransaction` with the configured
endpoint.

The seed bytes never leave `main/wallet/signer.ts`'s call frame. After the
transaction is sent, the local `Keypair` is allowed to fall out of scope —
the WDK manager retains the source-of-truth keypair for future signs.

### Verdict explanation — `source: "deterministic"` for v1

`Verdict.explanation` is populated by the deterministic builder for v1 with
`source: "deterministic"` and `status: "model-missing"`. When QVAC's LLM is
wired (next slice), the same field flips to `source: "qvac"` and
`status: "ready"` (or `"fallback"` when the explainer fails). The renderer
gates UI copy on the status enum already.

## Consequences

### What we get

- All three list views (queue / history / search) are real, backed by a
  durable record on disk.
- Sign + broadcast completes the round-trip — paste, review, approve,
  Solscan link.
- The verdict envelope is contract-stable — adding QVAC later is a content
  change inside `verdict/explanation.ts`, not a schema migration.

### What we accept

- LIKE search is crude. Acceptable for the demo path; vectorised search
  follows when embeddings are wired.
- Single-table schema. We don't normalise instructions or deltas into
  separate tables for v1; they live as JSON inside the verdict blob. We can
  migrate to a normalised shape if reporting needs it later.
- The keystore decrypt path costs Argon2id (~700 ms on reference hardware)
  per unlock. Sign operations after the first unlock reuse the WDK manager
  in memory — fast.

### Out of scope

- Multi-account history (one wallet for v1).
- Per-account database rotation.
- Encryption at rest for the review-records DB itself. The DB sits in the
  user's profile directory under OS-level file permissions; sensitive fields
  (mnemonic, private keys) are NEVER written there. Encryption is a V2
  hardening item if a real adversary scenario calls for it.

## Revisit when

- The LIKE search hits its first false-positive complaint. Vector search via
  `sqlite-vss` (or just an embeddings table joined manually) is the upgrade
  path.
- A migration is needed. v1's single table is intentionally simple — adding
  any new column triggers writing `migrate.ts` properly.
