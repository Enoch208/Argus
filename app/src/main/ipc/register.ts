/**
 * The single registration helper. Every IPC channel goes through this.
 *
 * Per CODE-RULES.md §Errors: throw inside the handler; the wrapper translates
 * to a typed `IpcResult` at the boundary. Per ARCHITECTURE.md, every channel
 * must zod-validate its input — main never trusts the renderer.
 */

import { ipcMain, type IpcMainInvokeEvent } from "electron";
import {
  channels,
  type ChannelInput,
  type ChannelName,
  type ChannelOutput,
  type IpcResult,
} from "@/shared/ipc";
import { ArgusError, toWire } from "@/shared/errors";
import { logger } from "@/main/log";

export function register<C extends ChannelName>(
  name: C,
  handler: (input: ChannelInput<C>, event: IpcMainInvokeEvent) => Promise<ChannelOutput<C>>,
): void {
  logger.info("ipc registered", { name });
  ipcMain.handle(name, async (event, raw): Promise<IpcResult<ChannelOutput<C>>> => {
    const schema = channels[name].input;
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      logger.warn("ipc input rejected", { name, issues: parsed.error.issues.slice(0, 2) });
      return {
        ok: false,
        error: toWire(
          new ArgusError(
            "IPC_INVALID_PAYLOAD",
            `payload rejected for ${name}: ${parsed.error.issues[0]?.message ?? "schema mismatch"}`,
          ),
        ),
      };
    }
    try {
      const data = await handler(parsed.data as ChannelInput<C>, event);
      logger.info("ipc ok", { name, dataKind: summarise(data) });
      return { ok: true, data };
    } catch (err) {
      // The redactor in `main/log.ts` strips secrets, so it's safe to log the
      // message + first stack frame in full. The wire-form sent to the
      // renderer remains code-only via `toWire()`.
      const message = err instanceof Error ? err.message : String(err);
      const firstFrame =
        err instanceof Error && err.stack
          ? err.stack.split("\n").slice(0, 2).join(" ")
          : null;
      if (err instanceof ArgusError) {
        logger.warn("ipc handler ArgusError", { name, code: err.code, message });
      } else {
        logger.error("ipc handler threw", { name, message, frame: firstFrame });
      }
      return { ok: false, error: toWire(err) };
    }
  });
}

function summarise(value: unknown): string {
  if (value && typeof value === "object" && "models" in value) {
    const m = (value as { models?: unknown[] }).models;
    return `ModelsStatus(models=${Array.isArray(m) ? m.length : "?"})`;
  }
  if (value === undefined) return "void";
  return Array.isArray(value) ? `array(${value.length})` : typeof value;
}
