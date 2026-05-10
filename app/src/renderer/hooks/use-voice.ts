/**
 * Voice-command hook.
 *
 * Captures a short audio clip via MediaRecorder, sends it to main for
 * `@qvac/sdk` `transcribe`, and returns the recognised text + parsed action.
 * The renderer wires the action to `useApproveReview` / `useBlockReview`.
 *
 * Lifecycle: one recording at a time. The hook owns the MediaRecorder and
 * its stream; calling `stop()` ends the active capture. If the user navigates
 * away mid-record, the cleanup effect tears the stream down.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { argus } from "@/renderer/ipc/client";

export type VoiceState = "idle" | "recording" | "transcribing" | "error";

export interface VoiceResult {
  text: string;
  action: "approve" | "block" | null;
}

export interface UseVoiceCommand {
  state: VoiceState;
  result: VoiceResult | null;
  error: string | null;
  /** Begin recording. No-op if already active. */
  start: () => Promise<void>;
  /** Finalise the active recording and trigger transcription. */
  stop: () => Promise<VoiceResult | null>;
  /** Discard the in-flight recording and reset state. */
  cancel: () => void;
}

export function useVoiceCommand(): UseVoiceCommand {
  const [state, setState] = useState<VoiceState>("idle");
  const [result, setResult] = useState<VoiceResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const cleanup = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const start = useCallback(async () => {
    if (state === "recording" || state === "transcribing") return;
    setError(null);
    setResult(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = pickMime();
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.start();
      recorderRef.current = recorder;
      setState("recording");
    } catch (err) {
      cleanup();
      setError(err instanceof Error ? err.message : "Microphone unavailable");
      setState("error");
    }
  }, [state, cleanup]);

  const stop = useCallback(async (): Promise<VoiceResult | null> => {
    const recorder = recorderRef.current;
    if (!recorder || state !== "recording") return null;
    setState("transcribing");

    const stopped = new Promise<void>((resolve) => {
      recorder.addEventListener("stop", () => resolve(), { once: true });
    });
    recorder.stop();
    await stopped;

    const mime = recorder.mimeType.split(";")[0]!;
    const blob = new Blob(chunksRef.current, { type: mime });
    cleanup();

    try {
      const buffer = await blob.arrayBuffer();
      const audio = arrayBufferToBase64(buffer);
      const out = await argus.voice.transcribe({
        audio,
        mime: ALLOWED_MIMES.has(mime) ? (mime as VoiceMime) : undefined,
      });
      const next: VoiceResult = { text: out.text, action: out.action };
      setResult(next);
      setState("idle");
      return next;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transcription failed");
      setState("error");
      return null;
    }
  }, [state, cleanup]);

  const cancel = useCallback(() => {
    if (recorderRef.current && state === "recording") {
      try {
        recorderRef.current.stop();
      } catch {
        /* recorder already inactive */
      }
    }
    cleanup();
    setResult(null);
    setError(null);
    setState("idle");
  }, [state, cleanup]);

  return { state, result, error, start, stop, cancel };
}

// ---------------------------------------------------------------------------

type VoiceMime = "audio/webm" | "audio/ogg" | "audio/wav" | "audio/mp4" | "audio/mpeg";

const ALLOWED_MIMES: ReadonlySet<string> = new Set<VoiceMime>([
  "audio/webm",
  "audio/ogg",
  "audio/wav",
  "audio/mp4",
  "audio/mpeg",
]);

/** Pick the first MIME the browser will let us record into that the IPC
 *  schema also accepts. Returns undefined if none match — MediaRecorder will
 *  fall back to its default. */
function pickMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates: VoiceMime[] = ["audio/webm", "audio/ogg", "audio/mp4"];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return undefined;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  // Chunked conversion — `btoa(String.fromCharCode(...new Uint8Array))` stack-
  // overflows for clips longer than ~1 second.
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
