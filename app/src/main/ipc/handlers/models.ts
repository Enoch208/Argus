import { register } from "@/main/ipc/register";
import { registry } from "@/main/models/registry";

export function registerModelsHandlers(): void {
  register("models.status", async () => registry.status());

  register("models.start", async () => {
    // Fire-and-forget: kick the download queue, return immediately.
    void registry.start();
    return { ok: true } as const;
  });

  register("models.pause", async () => {
    registry.pause();
    return { ok: true } as const;
  });
}
