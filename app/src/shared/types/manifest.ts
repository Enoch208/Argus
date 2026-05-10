/**
 * Model manifest — the signed list of files Argus needs to fetch on first run.
 *
 * STRICT (SECURITY.md §model integrity):
 *   - Every entry MUST have a sha256 in production. The schema accepts `null`
 *     during v1 boostrap so we can ship before computing every hash; the
 *     downloader logs a warning and proceeds. Pass 2 swaps null → real hash.
 *   - The manifest MAY carry an Ed25519 signature over its canonical JSON
 *     (minus the `signature` field). Verification is gated on a bundled pubkey
 *     in `resources/manifest.pubkey`. ADR-0006 records this.
 *   - URLs MUST be https. The main-process net allowlist enforces host as
 *     well as scheme.
 */

import { z } from "zod";

export const ManifestModel = z.object({
  /** Stable id used as the IPC key and the local filename root. kebab-case. */
  id: z.string().min(1).regex(/^[a-z0-9-]+$/),

  /** Display name shown in the Setup screen. */
  name: z.string().min(1),

  /** Functional role — drives the icon and the descriptive line. */
  role: z.string().min(1),

  /** Concrete filename on disk. */
  filename: z.string().min(1),

  /** Direct https URL. The downloader follows redirects via Electron's net. */
  url: z.string().url().startsWith("https://"),

  /** Expected size in bytes. Used to render the size chip and gate the disk
   * pre-check before download starts. */
  sizeBytes: z.number().int().positive(),

  /** sha256 of the file at `url`. `null` is accepted for v1 manifests; the
   * downloader logs a warning. Production manifests MUST be non-null. */
  sha256: z
    .string()
    .regex(/^[a-f0-9]{64}$/i)
    .nullable(),

  /** Approximate working-set RAM at inference. Display-only. */
  vram: z.string().min(1),
});
export type ManifestModel = z.infer<typeof ManifestModel>;

export const Manifest = z.object({
  version: z.literal(1),

  /** ISO-8601 timestamp of generation. */
  generatedAt: z.string().datetime(),

  /** Optional Ed25519 signature over the canonical JSON minus this field. */
  signature: z.string().nullable(),

  /** Hosts the downloader is allowed to fetch from. Must include the host
   * portion of every model URL. The main-process allowlist is derived from
   * this list. */
  allowedHosts: z.array(z.string().min(1)).min(1),

  /** The downloadable artefacts. Order is the rendered order. */
  models: z.array(ManifestModel).min(1),
});
export type Manifest = z.infer<typeof Manifest>;
