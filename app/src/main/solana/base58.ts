import bs58Module from "bs58";

type Base58Codec = {
  encode(input: Uint8Array): string;
  decode(input: string): Uint8Array;
};

type MaybeWrappedBase58 = Base58Codec & { default?: Base58Codec };

const wrapped = bs58Module as unknown as MaybeWrappedBase58;

export const bs58: Base58Codec = wrapped.default ?? wrapped;
