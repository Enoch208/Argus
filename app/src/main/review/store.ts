/**
 * Persistent review ledger.
 *
 * Stores only local review state: the raw unsigned transaction needed for a
 * future Approve click, the verdict shown to the user, and the final action.
 */

import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { app } from "electron";
import Database from "better-sqlite3";
import { ArgusError } from "@/shared/errors";
import {
  ReviewRecord,
  type ReviewRecord as ReviewRecordT,
  type Verdict,
} from "@/shared/types/verdict";

interface ReviewRow {
  id: string;
  raw: string;
  verdict_json: string;
  status: "pending" | "signed" | "blocked";
  signature: string | null;
  created_at: number;
  updated_at: number;
}

let cachedDb: Database.Database | null = null;

export function savePendingReview(raw: string, verdict: Verdict): ReviewRecordT {
  const now = Date.now();
  openDb()
    .prepare(
      `INSERT INTO reviews (id, raw, verdict_json, status, signature, created_at, updated_at)
       VALUES (@id, @raw, @verdictJson, 'pending', NULL, @now, @now)
       ON CONFLICT(id) DO UPDATE SET
         raw = excluded.raw,
         verdict_json = excluded.verdict_json,
         status = 'pending',
         signature = NULL,
         updated_at = excluded.updated_at`,
    )
    .run({
      id: verdict.id,
      raw,
      verdictJson: JSON.stringify(verdict),
      now,
    });
  return {
    id: verdict.id,
    status: "pending",
    verdict,
    signature: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function rawPendingReview(id: string): string {
  const row = openDb()
    .prepare<[string], Pick<ReviewRow, "raw">>(
      "SELECT raw FROM reviews WHERE id = ? AND status = 'pending'",
    )
    .get(id);
  if (!row) throw new ArgusError("TX_DECODE_FAILED", "review is no longer pending");
  return row.raw;
}

export function markReviewSigned(id: string, signature: string): void {
  openDb()
    .prepare(
      `UPDATE reviews
       SET status = 'signed', signature = ?, updated_at = ?
       WHERE id = ? AND status = 'pending'`,
    )
    .run(signature, Date.now(), id);
}

export function markReviewBlocked(id: string): void {
  openDb()
    .prepare(
      `UPDATE reviews
       SET status = 'blocked', signature = NULL, updated_at = ?
       WHERE id = ? AND status = 'pending'`,
    )
    .run(Date.now(), id);
}

export function queuedReviews(): ReviewRecordT[] {
  return rowsToRecords(
    openDb()
      .prepare<[], ReviewRow>(
        "SELECT * FROM reviews WHERE status = 'pending' ORDER BY updated_at DESC LIMIT 50",
      )
      .all(),
  );
}

export function reviewHistory(): ReviewRecordT[] {
  return rowsToRecords(
    openDb()
      .prepare<[], ReviewRow>(
        "SELECT * FROM reviews WHERE status != 'pending' ORDER BY updated_at DESC LIMIT 100",
      )
      .all(),
  );
}

export function searchReviews(query: string): ReviewRecordT[] {
  const q = query.trim();
  if (!q) return [...queuedReviews(), ...reviewHistory()].slice(0, 80);
  return rowsToRecords(
    openDb()
      .prepare<[string, string, string], ReviewRow>(
        `SELECT * FROM reviews
         WHERE verdict_json LIKE ?
            OR status LIKE ?
            OR signature LIKE ?
         ORDER BY updated_at DESC
         LIMIT 80`,
      )
      .all(`%${q}%`, `%${q}%`, `%${q}%`),
  );
}

function openDb(): Database.Database {
  if (cachedDb) return cachedDb;
  const dbPath = join(app.getPath("userData"), "reviews", "review-ledger.sqlite3");
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      raw TEXT NOT NULL,
      verdict_json TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('pending', 'signed', 'blocked')),
      signature TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_reviews_status_updated
      ON reviews(status, updated_at DESC);
  `);
  cachedDb = db;
  return cachedDb;
}

function rowsToRecords(rows: ReviewRow[]): ReviewRecordT[] {
  return rows.flatMap((row) => {
    try {
      const parsed = ReviewRecord.safeParse({
        id: row.id,
        status: row.status,
        verdict: JSON.parse(row.verdict_json),
        signature: row.signature,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      });
      return parsed.success ? [parsed.data] : [];
    } catch {
      return [];
    }
  });
}
