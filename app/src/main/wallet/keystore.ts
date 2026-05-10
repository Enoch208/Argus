/**
 * Encrypted-at-rest keystore for the BIP-39 mnemonic.
 *
 * STRICT (SECURITY.md §The seed phrase):
 *   - The plaintext mnemonic is NEVER persisted unencrypted.
 *   - The Argon2id-derived AES key buffer is zeroed after use.
 *   - Callers zero the plaintext mnemonic buffer themselves once they're
 *     done deriving from it.
 *
 * On-disk format (`keystore.json`):
 *   { version, argon2: { memoryCost, timeCost, parallelism, salt }, iv,
 *     authTag, ciphertext }
 *
 *   All byte fields are base64.
 */

import { hashRaw } from "@node-rs/argon2";

// `Algorithm` from `@node-rs/argon2` is a const enum; `isolatedModules` blocks
// importing it. Argon2id's numeric value is 2, fixed by the package.
const ARGON2_ID = 2;
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { app } from "electron";
import { ArgusError } from "@/shared/errors";

interface KeystoreFile {
  version: 1;
  argon2: {
    memoryCost: number;
    timeCost: number;
    parallelism: number;
    salt: string; // base64
  };
  iv: string; // base64
  authTag: string; // base64
  ciphertext: string; // base64
}

interface Argon2Params {
  memoryCost: number;
  timeCost: number;
  parallelism: number;
}

// RFC 9106 §4 "second recommended" parameters — solid for desktop.
const ARGON2_PARAMS: Argon2Params = {
  memoryCost: 65536, // 64 MiB
  timeCost: 3,
  parallelism: 4,
};

const KEY_LENGTH = 32; // AES-256
const IV_LENGTH = 12; // GCM standard
const SALT_LENGTH = 16;

let cachedPath: string | null = null;
function keystorePath(): string {
  if (!cachedPath) cachedPath = join(app.getPath("userData"), "wallet", "keystore.json");
  return cachedPath;
}

export function exists(): boolean {
  return existsSync(keystorePath());
}

export async function write(plaintext: Uint8Array, passphrase: string): Promise<void> {
  const salt = randomBytes(SALT_LENGTH);
  const key = await deriveKey(passphrase, salt);
  try {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const authTag = cipher.getAuthTag();

    const file: KeystoreFile = {
      version: 1,
      argon2: { ...ARGON2_PARAMS, salt: salt.toString("base64") },
      iv: iv.toString("base64"),
      authTag: authTag.toString("base64"),
      ciphertext: ciphertext.toString("base64"),
    };
    const path = keystorePath();
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(file, null, 2), { mode: 0o600 });
  } finally {
    zero(key);
  }
}

export async function decrypt(passphrase: string): Promise<Uint8Array> {
  const path = keystorePath();
  if (!existsSync(path)) {
    throw new ArgusError("WALLET_NOT_INITIALISED", "no keystore on disk");
  }
  const raw = await readFile(path, "utf8");
  const file = JSON.parse(raw) as KeystoreFile;
  if (file.version !== 1) {
    throw new ArgusError(
      "WALLET_NOT_INITIALISED",
      `unsupported keystore version ${file.version}`,
    );
  }
  const salt = Buffer.from(file.argon2.salt, "base64");
  const iv = Buffer.from(file.iv, "base64");
  const authTag = Buffer.from(file.authTag, "base64");
  const ciphertext = Buffer.from(file.ciphertext, "base64");

  const key = await deriveKey(passphrase, salt, file.argon2);
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    try {
      return Uint8Array.from(
        Buffer.concat([decipher.update(ciphertext), decipher.final()]),
      );
    } catch {
      // GCM auth fails iff the passphrase is wrong (or the file was tampered).
      throw new ArgusError("WALLET_BAD_PASSPHRASE", "incorrect passphrase");
    }
  } finally {
    zero(key);
  }
}

// ---------------------------------------------------------------------------

async function deriveKey(
  passphrase: string,
  salt: Buffer,
  params: Argon2Params = ARGON2_PARAMS,
): Promise<Buffer> {
  return hashRaw(passphrase, {
    algorithm: ARGON2_ID,
    salt,
    memoryCost: params.memoryCost,
    timeCost: params.timeCost,
    parallelism: params.parallelism,
    outputLen: KEY_LENGTH,
  });
}

function zero(buf: Buffer | Uint8Array): void {
  for (let i = 0; i < buf.length; i++) buf[i] = 0;
}
