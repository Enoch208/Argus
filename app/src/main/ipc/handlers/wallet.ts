import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { ArgusError } from "@/shared/errors";
import { register } from "@/main/ipc/register";
import { activeCluster, getConnection } from "@/main/solana/rpc";
import { buildSolTransfer } from "@/main/solana/transfer";
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

  register("wallet.balance", async () => {
    const info = wallet.info();
    if (!info.address) {
      return { lamports: 0, sol: 0, cluster: activeCluster() };
    }
    const lamports = await getConnection().getBalance(new PublicKey(info.address));
    return {
      lamports,
      sol: lamports / LAMPORTS_PER_SOL,
      cluster: activeCluster(),
    };
  });

  register("wallet.airdrop", async ({ sol }) => {
    const cluster = activeCluster();
    if (cluster !== "devnet" && cluster !== "testnet") {
      throw new ArgusError(
        "RPC_REJECTED",
        `airdrop is only available on devnet/testnet (current: ${cluster})`,
      );
    }
    const info = wallet.info();
    if (!info.address) {
      throw new ArgusError("WALLET_LOCKED", "wallet has no address yet");
    }
    const lamports = Math.round(sol * LAMPORTS_PER_SOL);
    const signature = await getConnection().requestAirdrop(
      new PublicKey(info.address),
      lamports,
    );
    // Wait for confirmation so the next balance poll reflects the airdrop.
    await getConnection().confirmTransaction(signature, "confirmed");
    return { signature };
  });

  register("wallet.buildTransfer", async ({ to, amountSol }) => {
    const info = wallet.info();
    if (info.state !== "unlocked" || !info.address) {
      throw new ArgusError("WALLET_LOCKED", "unlock the wallet before building a transfer");
    }
    const raw = await buildSolTransfer({
      from: info.address,
      to,
      amountSol,
    });
    return { raw };
  });
}
