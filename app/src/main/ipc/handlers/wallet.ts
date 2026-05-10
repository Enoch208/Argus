import { register } from "@/main/ipc/register";
import { wallet } from "@/main/wallet/manager";

export function registerWalletHandlers(): void {
  register("wallet.state", async () => wallet.info());

  register("wallet.create", async ({ passphrase }) => wallet.create(passphrase));

  register("wallet.confirmCreate", async () => {
    await wallet.confirmCreate();
    return { ok: true } as const;
  });

  register("wallet.import", async ({ mnemonic, passphrase }) =>
    wallet.import(mnemonic, passphrase),
  );

  register("wallet.unlock", async ({ passphrase }) => wallet.unlock(passphrase));

  register("wallet.lock", async () => {
    wallet.lock();
    return { ok: true } as const;
  });
}
