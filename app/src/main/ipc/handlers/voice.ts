/**
 * Voice IPC handlers.
 *
 * Today: `voice.transcribe` — STT for the queued-review approve/block command.
 * The renderer captures audio via MediaRecorder, base64-encodes it, and
 * sends it to `@qvac/sdk` `transcribe`. The recognised text is parsed for
 * an `approve` / `block` action; the renderer then triggers the matching
 * mutation. Keyword matching is local + cheap; a future upgrade can route
 * the text through the explainer LLM for natural-language commands.
 */

import { Buffer } from "node:buffer";
import { register } from "@/main/ipc/register";
import { synthesizeSpeech, transcribeAudio } from "@/main/llm/qvac";

export function registerVoiceHandlers(): void {
  register("voice.transcribe", async ({ audio }) => {
    const text = (await transcribeAudio(Buffer.from(audio, "base64"))) ?? "";
    return { text, action: parseAction(text) };
  });

  register("voice.speak", async ({ text }) => {
    const audio = await synthesizeSpeech(text);
    if (!audio) return { samples: [], sampleRate: 24_000 };
    return { samples: audio.samples, sampleRate: audio.sampleRate };
  });
}

/** Parse the transcript for an action keyword. Word-bounded so "disapprove"
 *  doesn't fire on `approve` and "unblock" doesn't fire on `block`. */
function parseAction(text: string): "approve" | "block" | null {
  const t = text.toLowerCase();
  if (/\bblock\b/.test(t) || /\bdeny\b/.test(t) || /\breject\b/.test(t)) return "block";
  if (/\bapprove\b/.test(t) || /\bsign\b/.test(t) || /\bconfirm\b/.test(t)) return "approve";
  return null;
}
