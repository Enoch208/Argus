import {
  Cpu,
  FileSearch,
  Layers,
  Mic,
  Sphere,
  View,
  type Icon,
} from "@/renderer/design/icons";

export const SETUP_COPY = {
  title: ["Argus is verifying", "your local models."],
  body:
    "Six models will run on your machine. After this download, your wallet activity never leaves your device.",
  startButton: "Begin download",
  pauseButton: "Pause",
  resumeButton: "Resume",
  readyButton: "Continue",
} as const;

/**
 * Icon mapping by manifest model id. Manifest entries don't carry icon refs
 * (they're a renderer concern). If a new model is added to the manifest
 * without a matching id here, we fall back to a generic icon.
 */
export const MODEL_ICONS: Record<string, Icon> = {
  "qwen3-1-7b-q4": Cpu,
  "minicpm-v-2-6-q4": View,
  "whisper-base-en": Mic,
  "piper-medium-en": Sphere,
  "paddle-ocr-mobile": FileSearch,
  "bge-small-en-v1-5": Layers,
};

export const fallbackIcon: Icon = Layers;
