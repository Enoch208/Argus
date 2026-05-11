import { useEffect, useRef, useState } from "react";
import { VolumeHigh } from "@/renderer/design/icons";

interface Props {
  /** Text to synthesise — typically `verdict.explanation.plainEnglish`. */
  text: string;
}

type State = "idle" | "playing" | "error";

/**
 * Read-aloud button for the VerdictCard. Use Chromium's built-in speech
 * synthesis for the product surface: it starts immediately and avoids
 * surprising the user with a multi-GB model download on first click.
 */
export function ReadAloud({ text }: Props) {
  const [state, setState] = useState<State>("idle");
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  function play() {
    if (state === "playing") return;
    try {
      if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
        setState("error");
        return;
      }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.94;
      utterance.pitch = 1;
      utterance.onend = () => setState("idle");
      utterance.onerror = () => setState("error");
      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
      setState("playing");
    } catch {
      setState("error");
    }
  }

  function stop() {
    window.speechSynthesis.cancel();
    utteranceRef.current = null;
    setState("idle");
  }

  const label =
    state === "playing" ? "Stop" : state === "error" ? "Voice unavailable" : "Read aloud";

  return (
    <button
      type="button"
      onClick={state === "playing" ? stop : play}
      disabled={state === "error"}
      title={
        state === "error"
          ? "Speech synthesis is not available in this runtime."
          : "Speak the verdict"
      }
      className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.035] px-2.5 py-1 font-mono text-[9.5px] uppercase tracking-[0.18em] text-white/55 transition-colors hover:border-white/22 hover:bg-white/[0.06] hover:text-white/80 disabled:cursor-not-allowed disabled:opacity-55"
    >
      <VolumeHigh size={11} />
      {label}
    </button>
  );
}
