import { scamIntelHealth } from "@/main/scam-intel/store";
import { urlIntelHealth } from "@/main/url-intel/store";
import { registry } from "@/main/models/registry";
import { register } from "@/main/ipc/register";
import type { StackLayer } from "@/shared/ipc";

export function registerStackHandlers(): void {
  register("stack.status", async () => {
    const models = registry.status();
    const readyModels = models.models.filter(
      (model) => model.state === "ready",
    );
    const urlIntel = urlIntelHealth();
    const scamIntel = scamIntelHealth();
    const explainerReady = models.models.some(
      (model) => model.id === "qwen3-1-7b-q4" && model.state === "ready",
    );
    const embeddingsReady = models.models.some(
      (model) => model.id === "bge-small-en-v1-5" && model.state === "ready",
    );
    const voiceReady = models.models.some(
      (model) => model.id === "whisper-base-en" && model.state === "ready",
    );

    const layers: StackLayer[] = [
      {
        id: "transaction-decoder",
        label: "Transaction decoder",
        state: "ready",
        value: "Active",
        detail: "Decodes Solana transfers before any approve action appears.",
      },
      {
        id: "screenshot-ocr",
        label: "Screenshot OCR",
        state: models.ready ? "ready" : "loading",
        value: models.ready
          ? "Ready"
          : `${readyModels.length}/${models.models.length}`,
        detail:
          "Reads wallet prompts, URL bars, and phishing page text on review.",
      },
      {
        id: "scam-domains",
        label: "Scam domains",
        state: urlIntel.blockedEntries > 0 ? "ready" : "attention",
        value: Intl.NumberFormat("en").format(urlIntel.blockedEntries),
        detail: "Phantom and ScamSniffer domain intelligence checked locally.",
      },
      {
        id: "wallet-blacklist",
        label: "Blocked wallets",
        state:
          scamIntel.localWalletBlacklistEntries > 0 ? "ready" : "attention",
        value: Intl.NumberFormat("en").format(
          scamIntel.localWalletBlacklistEntries,
        ),
        detail: "Bundled wallet blacklist is indexed for exact address checks.",
      },
      {
        id: "local-ai",
        label: "Local explainer",
        state: explainerReady && embeddingsReady ? "ready" : "loading",
        value: explainerReady ? "Ready" : "Loading",
        detail:
          "Summarises scam patterns without sending review data off device.",
      },
      {
        id: "voice",
        label: "Voice controls",
        state: voiceReady ? "ready" : "loading",
        value: voiceReady ? "Ready" : "Loading",
        detail:
          "Voice commands use local transcription; read aloud uses the browser.",
      },
    ];

    return {
      ready: layers.every((layer) => layer.state === "ready"),
      layers,
      modelsReady: readyModels.length,
      modelsTotal: models.models.length,
      scamDomains: urlIntel.blockedEntries,
      blacklistedWallets: scamIntel.localWalletBlacklistEntries,
    };
  });
}
