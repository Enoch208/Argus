export const REVIEW_COPY = {
  title: ["Check before you sign.", ""],
  body: "Paste the transaction request from a wallet or crypto app, drop a screenshot of a suspicious site or message, or use both. Argus explains what it sees and tells you whether it looks safe.",
  pasteLabel: "Transaction request",
  placeholder:
    "paste the raw transaction text here if the app gives you one",
  imageLabel: "Screenshot",
  imageHint: "Drag or paste (⌘V) a screenshot of the site, wallet prompt, or message. PNG, JPEG, or WebP.",
  imageEmpty: "Drop or paste a screenshot here.",
  imageRemove: "Remove",
  reviewButton: "Review",
  reviewing: "Checking…",
  approveButton: "Approve",
  blockButton: "Block",
  emptyHint:
    "Add a transaction request, a screenshot, or both. Your verdict will appear here.",
} as const;
