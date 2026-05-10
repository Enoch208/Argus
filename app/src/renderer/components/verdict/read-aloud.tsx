import { useEffect, useRef, useState } from "react";
import { VolumeHigh } from "@/renderer/design/icons";
import { argus } from "@/renderer/ipc/client";

interface Props {
  /** Text to synthesise — typically `verdict.explanation.plainEnglish`. */
  text: string;
}

type State = "idle" | "loading" | "playing" | "error";

/**
 * Read-aloud button for the VerdictCard. Calls `@qvac/sdk` `textToSpeech`
 * via main, then plays the returned PCM samples through the renderer's
 * AudioContext. First click triggers the Chatterbox model download
 * (~1 GB, SDK-managed) and may take a minute; subsequent clicks reuse the
 * loaded model.
 *
 * Failure mode: if the SDK / model isn't available, the IPC returns an
 * empty sample array. We surface that as the `error` state so the user
 * knows TTS isn't ready, rather than playing silence.
 */
export function ReadAloud({ text }: Props) {
  const [state, setState] = useState<State>("idle");
  const ctxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    return () => {
      sourceRef.current?.stop();
      void ctxRef.current?.close();
    };
  }, []);

  async function play() {
    if (state === "loading" || state === "playing") return;
    setState("loading");
    try {
      const { samples, sampleRate } = await argus.voice.speak({ text });
      if (samples.length === 0) {
        setState("error");
        return;
      }
      const ctx = ctxRef.current ?? new AudioContext({ sampleRate });
      ctxRef.current = ctx;
      const buffer = ctx.createBuffer(1, samples.length, sampleRate);
      buffer.copyToChannel(Float32Array.from(samples), 0);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.onended = () => setState("idle");
      sourceRef.current?.stop();
      sourceRef.current = source;
      source.start();
      setState("playing");
    } catch {
      setState("error");
    }
  }

  function stop() {
    sourceRef.current?.stop();
    sourceRef.current = null;
    setState("idle");
  }

  const label =
    state === "loading"
      ? "QVAC · loading TTS"
      : state === "playing"
        ? "Stop"
        : state === "error"
          ? "TTS unavailable"
          : "Read aloud";

  return (
    <button
      type="button"
      onClick={state === "playing" ? stop : play}
      disabled={state === "loading" || state === "error"}
      title={
        state === "error"
          ? "TTS model isn't loaded yet. First call downloads the Chatterbox bundle."
          : "Speak the verdict (QVAC · textToSpeech)"
      }
      className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.035] px-2.5 py-1 font-mono text-[9.5px] uppercase tracking-[0.18em] text-white/55 transition-colors hover:border-white/22 hover:bg-white/[0.06] hover:text-white/80 disabled:cursor-not-allowed disabled:opacity-55"
    >
      <VolumeHigh size={11} />
      {label}
    </button>
  );
}
