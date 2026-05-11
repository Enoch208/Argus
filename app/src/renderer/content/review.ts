export const REVIEW_COPY = {
  title: ["Check before you sign.", ""],
  body: "Paste a URL, wallet address, transaction, message, or drop a screenshot of a suspicious site. Argus checks scam patterns, local blocklists, and anything signable before you continue.",
  pasteLabel: "Anything suspicious",
  placeholder:
    "paste a URL, domain, wallet address, transaction ID, message, or raw transaction",
  imageLabel: "Screenshot",
  imageHint:
    "Drag or paste (⌘V) a screenshot of the site, wallet prompt, or message. PNG, JPEG, or WebP.",
  imageEmpty: "Drop or paste a screenshot here.",
  imageRemove: "Remove",
  reviewButton: "Review",
  reviewing: "Checking…",
  approveButton: "Approve",
  blockButton: "Block",
  emptyHint:
    "Add text, a link, a wallet address, a screenshot, or a transaction. Your verdict will appear here.",
} as const;
