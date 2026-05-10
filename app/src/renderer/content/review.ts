export const REVIEW_COPY = {
  title: ["Review a transaction.", ""],
  body: "Paste a base58-encoded Solana transaction. Argus decodes the instructions, runs a chain simulation, and surfaces a verdict you can act on.",
  pasteLabel: "Base58 transaction",
  placeholder:
    "paste here — typically copied from a dApp's 'advanced' or 'raw' panel before signing",
  reviewButton: "Review",
  reviewing: "Decoding · simulating…",
  approveButton: "Approve",
  blockButton: "Block",
  emptyHint:
    "No transaction yet. The verdict card will appear here as soon as Argus has reviewed one.",
} as const;
