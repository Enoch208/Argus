/**
 * Pulls the Phantom Solana blocklist + whitelist into a bundled JSON corpus.
 *
 * Source: github.com/phantom/blocklist (Apache-2.0). The repo ships YAML, so
 * we inline-parse the very narrow shape (`- url: <domain>` with optional
 * `versionTag`) without adding a YAML dependency.
 *
 * Output: app/resources/data/phantom-blocklist.json — read at module init by
 * `main/url-intel/store.ts`. Re-run with:
 *
 *     npx tsx scripts/refresh-url-blocklist.ts
 *
 * The pinned commit is recorded in the JSON so the bundled corpus is
 * reproducible and we can show provenance to reviewers.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const REPO = "phantom/blocklist";
const BRANCH = "master";
const OUT = join(__dirname, "..", "resources", "data", "phantom-blocklist.json");

interface Entry {
  domain: string;
}

async function fetchText(url: string): Promise<string> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.text();
}

async function fetchJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json() as Promise<T>;
}

function parseUrlList(yaml: string): string[] {
  const out = new Set<string>();
  for (const line of yaml.split("\n")) {
    const m = /^\s*-\s+url:\s+["']?([^"'\s]+)["']?\s*$/.exec(line);
    if (!m) continue;
    out.add(normaliseDomain(m[1]!));
  }
  return [...out].filter(Boolean);
}

function normaliseDomain(s: string): string {
  let n = s.trim().toLowerCase();
  n = n.replace(/^https?:\/\//, "");
  n = n.replace(/^www\./, "");
  const slash = n.indexOf("/");
  if (slash !== -1) n = n.slice(0, slash);
  return n;
}

interface CommitMeta {
  sha: string;
  commit: { author: { date: string } };
}

async function main() {
  console.log(`fetching ${REPO}@${BRANCH}…`);
  const [blocklistYaml, whitelistYaml, commit] = await Promise.all([
    fetchText(`https://raw.githubusercontent.com/${REPO}/${BRANCH}/blocklist.yaml`),
    fetchText(`https://raw.githubusercontent.com/${REPO}/${BRANCH}/whitelist.yaml`),
    fetchJson<CommitMeta[]>(
      `https://api.github.com/repos/${REPO}/commits?sha=${BRANCH}&per_page=1`,
    ).then((arr) => arr[0]!),
  ]);

  const blocklist: Entry[] = parseUrlList(blocklistYaml).map((domain) => ({ domain }));
  // Phantom's whitelist contains hosting wildcards (`*.vercel.app`) which we
  // skip — they're not useful as exact-match allow entries.
  const whitelist = parseUrlList(whitelistYaml).filter((d) => !d.startsWith("*."));

  const payload = {
    version: 1,
    fetchedAt: new Date().toISOString(),
    source: `github.com/${REPO}`,
    license: "Apache-2.0",
    commit: commit.sha,
    commitDate: commit.commit.author.date,
    blocklist,
    whitelist,
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(payload, null, 2) + "\n", "utf8");

  console.log(`wrote ${OUT}`);
  console.log(`  blocklist: ${blocklist.length} entries`);
  console.log(`  whitelist: ${whitelist.length} entries`);
  console.log(`  commit:    ${commit.sha.slice(0, 7)} (${commit.commit.author.date})`);
}

main().catch((err: unknown) => {
  console.error("refresh failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
