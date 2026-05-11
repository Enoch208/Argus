/**
 * Pulls ScamSniffer's public delayed phishing-domain feed into a bundled JSON
 * corpus. Runtime review stays local: the app imports the snapshot and checks
 * domains through an in-memory Map.
 *
 * Source: github.com/scamsniffer/scam-database (GPL-3.0).
 * Re-run with:
 *
 *     npx tsx scripts/refresh-scamsniffer-domains.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const REPO = "scamsniffer/scam-database";
const BRANCH = "main";
const OUT = join(
  __dirname,
  "..",
  "resources",
  "data",
  "scamsniffer-domains.json",
);

interface CommitMeta {
  sha: string;
  commit: { author: { date: string } };
}

async function fetchJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json() as Promise<T>;
}

function normaliseDomain(s: string): string {
  let n = s.trim().toLowerCase();
  n = n.replace(/^https?:\/\//, "");
  n = n.replace(/^www\./, "");
  const slash = n.indexOf("/");
  if (slash !== -1) n = n.slice(0, slash);
  const q = n.indexOf("?");
  if (q !== -1) n = n.slice(0, q);
  const colon = n.indexOf(":");
  if (colon !== -1) n = n.slice(0, colon);
  return n;
}

async function main() {
  console.log(`fetching ${REPO}@${BRANCH} domains...`);
  const [rawDomains, commit] = await Promise.all([
    fetchJson<string[]>(
      `https://raw.githubusercontent.com/${REPO}/refs/heads/${BRANCH}/blacklist/domains.json`,
    ),
    fetchJson<CommitMeta[]>(
      `https://api.github.com/repos/${REPO}/commits?sha=${BRANCH}&per_page=1`,
    ).then((arr) => arr[0]!),
  ]);

  const domains = [
    ...new Set(rawDomains.map(normaliseDomain).filter(Boolean)),
  ].sort();
  const payload = {
    version: 1,
    fetchedAt: new Date().toISOString(),
    source: `github.com/${REPO}`,
    license: "GPL-3.0",
    commit: commit.sha,
    commitDate: commit.commit.author.date,
    domains,
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(payload, null, 2) + "\n", "utf8");

  console.log(`wrote ${OUT}`);
  console.log(`  domains: ${domains.length} entries`);
  console.log(
    `  commit:  ${commit.sha.slice(0, 7)} (${commit.commit.author.date})`,
  );
}

main().catch((err: unknown) => {
  console.error("refresh failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
