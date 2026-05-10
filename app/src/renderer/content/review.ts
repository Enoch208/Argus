export const REVIEW_COPY = {
  title: ["Review a transaction or screenshot.", ""],
  body: "Paste a base58-encoded Solana transaction, drop a screenshot of a suspicious dApp / message, or both. Argus decodes the transaction, runs a chain simulation, OCRs the image for URLs, and surfaces a verdict you can act on.",
  pasteLabel: "Base58 transaction",
  placeholder:
    "paste here — typically copied from a dApp's 'advanced' or 'raw' panel before signing",
  imageLabel: "Screenshot",
  imageHint: "Drag or paste (⌘V) a screenshot of the dApp or message. PNG, JPEG, or WebP.",
  imageEmpty: "No screenshot. Drop or paste one here.",
  imageRemove: "Remove",
  reviewButton: "Review",
  reviewing: "Decoding · simulating · OCR…",
  approveButton: "Approve",
  blockButton: "Block",
  emptyHint:
    "No review yet. The verdict card will appear here once Argus has analysed your input.",
} as const;
