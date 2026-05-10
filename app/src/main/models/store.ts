/**
 * Where models live on disk + the manifest loader.
 *
 * SECURITY.md §model integrity: every file is mmap-loaded read-only after
 * verification. A model file that's been mutated at rest fails sha256 on the
 * next launch and the registry refuses to mark it `ready`.
 */

import { app } from "electron";
import { existsSync, statSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { Manifest } from "@/shared/types/manifest";
import { ArgusError } from "@/shared/errors";

let cachedDir: string | null = null;

export function modelsDir(): string {
  if (!cachedDir) cachedDir = join(app.getPath("userData"), "models");
  return cachedDir;
}

export async function ensureModelsDir(): Promise<string> {
  const dir = modelsDir();
  await mkdir(dir, { recursive: true });
  return dir;
}

export function modelPath(filename: string): string {
  return join(modelsDir(), filename);
}

export function partialPath(filename: string): string {
  return `${modelPath(filename)}.partial`;
}

/** Best-effort byte length of an existing partial. 0 if absent. */
export function existingBytes(filename: string): number {
  const p = partialPath(filename);
  try {
    return existsSync(p) ? statSync(p).size : 0;
  } catch {
    return 0;
  }
}

/** True if the final (verified) file exists at expected size. */
export function isAlreadyComplete(filename: string, expectedSize: number): boolean {
  const p = modelPath(filename);
  try {
    return existsSync(p) && statSync(p).size === expectedSize;
  } catch {
    return false;
  }
}

/**
 * Reads the bundled manifest from `resources/manifest.json`. Throws
 * `MODEL_MANIFEST_INVALID` on parse failure — never silently coerces.
 */
export async function loadManifest(): Promise<Manifest> {
  // In dev: manifest.json sits at the repo's `resources/` directory.
  // In prod: it's bundled under `process.resourcesPath`.
  const candidates = [
    join(process.resourcesPath ?? "", "manifest.json"),
    join(app.getAppPath(), "resources", "manifest.json"),
    join(app.getAppPath(), "..", "resources", "manifest.json"),
  ];
  let raw: string | null = null;
  for (const c of candidates) {
    if (!c || !existsSync(c)) continue;
    raw = await readFile(c, "utf8");
    break;
  }
  if (!raw) {
    throw new ArgusError(
      "MODEL_MANIFEST_INVALID",
      "manifest.json not found in app resources",
    );
  }
  const parsed = Manifest.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    throw new ArgusError(
      "MODEL_MANIFEST_INVALID",
      `manifest schema violation: ${parsed.error.issues
        .map((i) => i.path.join(".") + " " + i.message)
        .slice(0, 3)
        .join("; ")}`,
    );
  }
  return parsed.data;
}
