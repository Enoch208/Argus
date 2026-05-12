/**
 * ASAR-aware `child_process.spawn` shim.
 *
 * Why this exists: `@qvac/sdk` spawns the platform-specific Bare runtime
 * binary as a subprocess. The binary lives at
 * `app.asar.unpacked/node_modules/bare-runtime-<platform>-<arch>/bin/bare`
 * (electron-builder unpacks it via the `asarUnpack` glob), but
 * `bare-runtime-<platform>-<arch>/index.js` resolves the path relative to
 * its own `__filename` — which sits *inside* `app.asar`. The result is a
 * path like:
 *
 *     /Applications/Argus.app/Contents/Resources/app.asar/.../bin/bare
 *
 * Node's `child_process.spawn` calls native `execve` on that path, the OS
 * walks the components, hits `app.asar` (a single file, not a directory),
 * and returns `ENOTDIR`. The asar virtual filesystem is only seen by
 * Electron's `fs` shim — `spawn` bypasses it.
 *
 * The fix: intercept `spawn` (and `spawnSync`) and rewrite any path that
 * contains `/app.asar/` to point at `/app.asar.unpacked/` instead.
 *
 * This file is imported FIRST in `main/index.ts` so the patch is live
 * before any QVAC / WDK / native-binding code loads.
 */

import childProcess from "node:child_process";

const ASAR_SEGMENT = "/app.asar/";
const UNPACKED_SEGMENT = "/app.asar.unpacked/";

function rewriteAsarPath(value: unknown): unknown {
  if (typeof value !== "string") return value;
  if (!value.includes(ASAR_SEGMENT)) return value;
  return value.replace(ASAR_SEGMENT, UNPACKED_SEGMENT);
}

/**
 * Rewrite the args array passed to `spawn` / `execFile`. Many native runtimes
 * (Bare, llama.cpp servers, ffmpeg shims) receive script-paths or asset-paths
 * as positional CLI args. When those paths point inside `app.asar`, the child
 * process's own filesystem (which doesn't understand Electron's asar shim)
 * can't open them. Rewriting each string element to its `.asar.unpacked`
 * sibling keeps third-party code working without patching it.
 */
function rewriteAsarPathsInArgs(args: unknown): unknown {
  if (!Array.isArray(args)) return args;
  return args.map((arg) => rewriteAsarPath(arg));
}

type SpawnFn = typeof childProcess.spawn;
type SpawnSyncFn = typeof childProcess.spawnSync;
type ExecFileFn = typeof childProcess.execFile;
type ExecFileSyncFn = typeof childProcess.execFileSync;

const originalSpawn: SpawnFn = childProcess.spawn;
const originalSpawnSync: SpawnSyncFn = childProcess.spawnSync;
const originalExecFile: ExecFileFn = childProcess.execFile;
const originalExecFileSync: ExecFileSyncFn = childProcess.execFileSync;

// We mutate the module's exports so any consumer that captured a reference
// after this point sees the patched versions. Consumers that captured
// `childProcess.spawn` *before* this file ran would miss the shim — that's
// why this module is the first import in `main/index.ts`.
// We accept `any` here because each wrapped function has a rich overload set
// (spawn alone has 4 signatures) and the goal is a one-line path rewrite, not
// re-specifying the full Node typings. The cast keeps the public type intact.

// Both the command path (args[0]) AND the second positional — which is the
// args array passed to the child — get the asar→asar.unpacked rewrite. The
// rest of the call signature (options, callbacks) is passed through.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(childProcess as { spawn: SpawnFn }).spawn = function patchedSpawn(...args: any[]) {
  if (args.length > 0) args[0] = rewriteAsarPath(args[0]);
  if (args.length > 1) args[1] = rewriteAsarPathsInArgs(args[1]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (originalSpawn as any).apply(childProcess, args);
} as SpawnFn;

(childProcess as { spawnSync: SpawnSyncFn }).spawnSync = function patchedSpawnSync(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ...args: any[]
) {
  if (args.length > 0) args[0] = rewriteAsarPath(args[0]);
  if (args.length > 1) args[1] = rewriteAsarPathsInArgs(args[1]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (originalSpawnSync as any).apply(childProcess, args);
} as SpawnSyncFn;

(childProcess as { execFile: ExecFileFn }).execFile = function patchedExecFile(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ...args: any[]
) {
  if (args.length > 0) args[0] = rewriteAsarPath(args[0]);
  if (args.length > 1) args[1] = rewriteAsarPathsInArgs(args[1]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (originalExecFile as any).apply(childProcess, args);
} as ExecFileFn;

(childProcess as { execFileSync: ExecFileSyncFn }).execFileSync = function patchedExecFileSync(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ...args: any[]
) {
  if (args.length > 0) args[0] = rewriteAsarPath(args[0]);
  if (args.length > 1) args[1] = rewriteAsarPathsInArgs(args[1]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (originalExecFileSync as any).apply(childProcess, args);
} as ExecFileSyncFn;
