import { useEffect, useRef } from "react";
import { Mic, Cancel } from "@/renderer/design/icons";
import { useVoiceCommand } from "@/renderer/hooks/use-voice";

interface Props {
  /** Called with the parsed action when the user finishes speaking and the
   *  transcript matches an `approve` / `block` keyword. */
  onAction: (action: "approve" | "block") => void;
  /** Disable the button while another action is in flight. */
  disabled?: boolean;
}

/**
 * Voice button. Press once to start recording (live ring + label), press
 * again to stop. The hook captures audio via MediaRecorder, sends it to
 * `@qvac/sdk` `transcribe` over IPC, and dispatches the parsed action back
 * up to the caller. The transcript is displayed below the button so users
 * can see what Whisper heard before the action fires.
 */
export function VoiceCommand({ onAction, disabled }: Props) {
  const { state, result, error, start, stop } = useVoiceCommand();
  const lastFiredRef = useRef<string | null>(null);

  useEffect(() => {
    if (!result?.action) return;
    // Guard against double-fire on re-render: every transcribe returns a
    // fresh object identity, so identity check is enough.
    const fingerprint = `${result.text}|${result.action}`;
    if (lastFiredRef.current === fingerprint) return;
    lastFiredRef.current = fingerprint;
    onAction(result.action);
  }, [result, onAction]);

  const recording = state === "recording";
  const transcribing = state === "transcribing";
  const busy = recording || transcribing;

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => (recording ? void stop() : void start())}
        disabled={disabled || transcribing}
        title={
          recording
            ? "Stop recording"
            : "Voice command — say 'approve' or 'block'"
        }
        className={
          "inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-[13px] font-normal transition disabled:cursor-not-allowed disabled:opacity-40 " +
          (recording
            ? "border-rose-400/50 bg-rose-500/[0.08] text-rose-100 shadow-[0_0_0_4px_rgba(244,63,94,0.12)]"
            : "border-white/[0.12] bg-white/[0.03] text-white/82 hover:border-white/22 hover:bg-white/[0.06]")
        }
      >
        {recording ? (
          <>
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400/70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-400" />
            </span>
            Stop recording
          </>
        ) : transcribing ? (
          <>
            <Mic size={13} className="text-white/60" />
            Transcribing...
          </>
        ) : (
          <>
            <Mic size={13} className="text-white/60" />
            Voice command
          </>
        )}
      </button>

      {(busy || result || error) && (
        <div className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-white/40">
          {recording && <span className="text-rose-200/70">listening…</span>}
          {transcribing && <span>QVAC · transcribing</span>}
          {result && !result.action && (
            <span>
              heard: <span className="text-white/65">"{result.text}"</span> · no
              command matched
            </span>
          )}
          {result?.action === "approve" && (
            <span className="text-emerald-200/70">
              <Cancel size={11} className="mr-1 inline -translate-y-px" />
              approve fired
            </span>
          )}
          {result?.action === "block" && (
            <span className="text-rose-200/70">block fired</span>
          )}
          {error && <span className="text-rose-200/70">{error}</span>}
        </div>
      )}
    </div>
  );
}
