/** Welcome / wallet-setup copy. Edit text here, never in components. */

export const WELCOME_COPY = {
  intro: {
    eyebrow: "Welcome",
    title: ["Set up your", "Argus wallet."],
    body:
      "Argus is a self-custodial Solana wallet. The seed phrase you create is encrypted with your passphrase and never leaves this device.",
    create: "Create new wallet",
    import: "Import existing",
  },
  passphrase: {
    title: "Choose a passphrase",
    body: "Argus uses Argon2id to encrypt your seed at rest. Pick something you'll remember — there's no recovery if you lose it.",
    field: "Passphrase",
    confirm: "Confirm passphrase",
    rule: "At least 8 characters. Stronger is better.",
    next: "Continue",
    back: "Back",
    mismatch: "Passphrases don't match.",
  },
  reveal: {
    eyebrow: "Your seed",
    title: "Write these down. Offline.",
    body:
      "These twelve words are the only way to recover your wallet. Anyone who sees them owns it. Argus will not show them again.",
    confirm: "I have stored these words offline",
    finish: "Finish setup",
  },
  importStep: {
    title: "Import a wallet",
    body: "Paste your 12 or 24 word recovery phrase below. Words are checked against the BIP-39 wordlist before import.",
    placeholder:
      "twelve recovery words separated by spaces — Argus checks the BIP-39 checksum before importing",
    next: "Import",
  },
  unlock: {
    eyebrow: "Welcome back",
    title: "Unlock your wallet",
    body: "Enter the passphrase you set when creating this wallet.",
    field: "Passphrase",
    next: "Unlock",
    forgot:
      "Forgot it? There's no recovery — re-import from your seed phrase.",
  },
} as const;
