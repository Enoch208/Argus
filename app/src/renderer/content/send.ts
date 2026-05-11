export const SEND_COPY = {
  title: ["Send SOL.", "Reviewed by Argus first."],
  body: "Argus builds your transfer locally, runs it through the same AI verdict pipeline as any other signature request, and only signs after you approve. The transaction never leaves your device unsigned.",
  toLabel: "Recipient",
  toPlaceholder: "Solana address (base58)",
  amountLabel: "Amount",
  amountSuffix: "SOL",
  reviewButton: "Review transfer",
  reviewing: "Building & checking…",
  airdropLabel: "Get 0.1 test SOL",
  airdropPending: "Requesting airdrop…",
  approveButton: "Approve & send",
  blockButton: "Block",
  emptyHint:
    "Enter a destination and amount. Argus will review the transfer before signing.",
  insufficient: "Amount exceeds your wallet balance.",
} as const;
