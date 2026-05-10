/**
 * DETERMINISTIC DEMO KEYPAIRS — these are NOT a wallet.
 *
 * The mnemonics below have been committed to the repo on purpose. They
 * generate the keypairs `scripts/demo.ts` uses to build canned base58
 * transactions for the npm-run demo flows.
 *
 * STRICT:
 *   - Never use these seeds outside `scripts/demo.ts`.
 *   - Never fund their derived addresses with real assets.
 *   - The wallet manager (`main/wallet/manager.ts`) and the keystore
 *     (`main/wallet/keystore.ts`) MUST NOT touch this file.
 */

/** Deterministic dummy fee-payer for `demo:phishing` and `demo:safe`. */
export const DEMO_PAYER_MNEMONIC =
  "civil bounce voyage primary basket exit drum trash cloth raw decade dial";

/** Deterministic dummy recipient for `demo:safe`. */
export const DEMO_RECIPIENT_MNEMONIC =
  "fabric kiwi cement leaf mandate orient public switch tornado verify wagon zone";
