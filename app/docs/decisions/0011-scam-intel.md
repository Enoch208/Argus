# ADR-0011: Bundled scam-intel corpus, three SQLite tables, inline seeds

**Status:** Accepted · 2026-05-10

## Context

[PRD F-05](../../../prd.md) requires Argus to lookup recipient addresses,
mints, and program ids against a local scam-intel corpus and surface matches
as verdict citations. [§14 risk #4](../../../prd.md) flags freshness as a
known limitation; [§17](../../../prd.md) defers federated P2P updates to V2.

The pipeline already produces decoded instructions; it just didn't ask
"is this address known-bad" yet. We need: a corpus, a place to put it, and
lookup functions the verdict pipeline can call before assembling citations.

## Decision

### Three independent tables in one SQLite DB

Three same-shape tables under a single domain-owned DB at
`userData/intel/scam-intel.sqlite3`:

```sql
program_intel (program_id PK, label, severity, source, note, updated_at)
wallet_intel  (address    PK, label, severity, source, note, updated_at)
mint_intel    (address    PK, label, severity, source, note, updated_at)
```

Three tables instead of one + a `kind` column so each lookup goes through
its own primary key without scanning across kinds. Severity is `allow |
caution | danger` (allow = canonical infra; caution = known router /
marketplace; danger = drainer). Source records provenance — corpus pruning
later filters on it.

The DB is owned by `main/scam-intel/store.ts`; per
[STRUCTURE.md §Anti-patterns](../STRUCTURE.md), each domain owns its own
data — we don't grow a generic `db/` drawer.

### Inline TypeScript seeds, not a JSON file

Seed entries live as `const PROGRAM_SEEDS / WALLET_SEEDS / MINT_SEEDS`
arrays inside `store.ts`. Reasons:

- Git-tracked next to the schema. Schema and corpus rev together; no risk
  of a JSON shape drifting out of sync.
- Type-checked. A misspelled `severity` value fails `tsc`, not runtime.
- One file to read to understand the entire intel surface.

When the corpus grows (target: ≥ 100 entries), we'll move it to a JSON
file under `resources/` and import idempotently on first launch — but
until then, the bootstrap corpus is small enough to inline.

### v1 corpus — provenance and counts

| Source | Entries | What |
|---|---|---|
| `Argus bundled registry` | 7 | Canonical infra programs (System, SPL Token, Token-2022, ATA, Jupiter v6, Magic Eden v2) + 1 demo fixture wallet for `npm run demo:phishing` |
| [`mandiant/clinksink-2024`](https://cloud.google.com/blog/topics/threat-intelligence/solana-cryptocurrency-stolen-clinksink-drainer-campaigns) | 43 wallets | CLINKSINK drainer-as-a-service: 2 operator wallets + 41 affiliate wallets (full table from Mandiant Threat Intelligence, 2024-01-09; ≥ 1,491 SOL confirmed-stolen flow into the primary operator) |
| [`solanafm/scam-token-wallets-2024`](https://solanafm.substack.com/p/flagged-scam-token-wallets-on-solana) | 5 deployer/treasury (danger) + 5 manipulator (caution) + 9 mints (danger) | SolanaFM analyst-flagged scam-token deployers, the treasury wallet, and the SPL mints they deployed |
| `circle-canon` | 1 mint | Canonical USDC, low-severity informational citation |

**Total v1: 6 programs · 49 wallets · 10 mints = 65 entries.**

The demo wallet (`Drainerz1111…`) intentionally remains so the
`demo:phishing` script lands a deterministic RED verdict regardless of
network state.

### Lookup — three functions called from `verdict/pipeline.ts`

```ts
lookupProgramIntel(programIds): ProgramIntel[]
lookupWalletIntel(addresses):   WalletIntel[]
lookupMintIntel(mints):         MintIntel[]
```

The pipeline's `lookupAllIntel(ix)` walks decoded instructions, harvests
the relevant address-typed details (`sol-transfer.to`,
`spl-transfer.destination`, `spl-approve.delegate`,
`spl-close-account.destination`), and runs all three lookups.

Severity → verdict level:

| Severity (any table) | Effect |
|---|---|
| danger  | Force verdict to RED (overrides simulation success) |
| caution | Force at least YELLOW (no-op since pipeline defaults YELLOW) |
| allow   | Citation only, no level change |

## Consequences

### What we get

- Every verdict cites its scam-intel surface explicitly:
  `"Local scam-intel checked 3 programs; no blocklist matches."` on the
  clean path, `"Local scam-intel flagged recipient Argus demo drainer
  hot-wallet"` on the RED path.
- Three lookups, one DB, one transaction: the seed step on first launch
  is sub-millisecond.
- Schema-level severity → level mapping makes the trust calculus explicit
  and reviewable in one place.

### What we accept

- Bundled seed is stale the moment we ship. Mitigation: visible corpus
  freshness in the Stack route ("scam-intel last refreshed: 2026-05-10")
  and a clear "this is a demo seed" label until the full scrape lands.
- No vector / fuzzy matching for v1. Exact-string matches only. The PRD's
  *"address shares a cluster with known drainer wallets"* use case
  requires embeddings, which the personal-history-RAG slice will
  introduce.
- Seeds are inline TypeScript. When the corpus crosses ~1k entries, this
  bloats the bundle and we should migrate to bundled JSON; the schema is
  unchanged.

### Out of scope

- Federated peer updates over Holepunch (V2 per PRD §17).
- Per-user corpus overrides ("trust this address").
- Cluster-similarity matching (waits for embeddings).

## Revisit when

- The inline corpus crosses ~100 entries and the seed file gets unwieldy.
  Migrate to `resources/scam-intel.seed.json` with the same shape.
- Vector / cluster matching is desired. `sqlite-vss` is the upgrade path —
  same DB file, new index.
