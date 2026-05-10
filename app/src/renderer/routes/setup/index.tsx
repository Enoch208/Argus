import { type as t } from "@/renderer/design/tokens";
import { useEffect, useMemo, useRef, useState } from "react";
import { MODEL_ICONS, SETUP_COPY, fallbackIcon } from "@/renderer/content/setup";
import {
  useModels,
  usePauseModels,
  useStartModels,
} from "@/renderer/hooks/use-models";
import type { ModelProgress, ModelState, ModelsStatus } from "@/shared/ipc";
import { cn } from "@/renderer/lib/cn";

export default function SetupRoute() {
  const m = useModels();
  const { data, isLoading } = m;
  const start = useStartModels();
  const pause = usePauseModels();
  const startRequested = useRef(false);

  const status = data ?? PLACEHOLDER;
  const telemetry = useDownloadTelemetry(status);
  const allReady = status.ready;
  const anyActive = status.active;
  const startError = start.error instanceof Error ? start.error.message : null;
  const pauseError = pause.error instanceof Error ? pause.error.message : null;
  const requestStart = () => {
    if (start.isPending || startRequested.current) return;
    startRequested.current = true;
    // This log is intentionally short-lived while we prove the renderer click
    // reaches IPC. Main-process logs should show `models.start` immediately
    // after this line.
    console.info("[argus] setup:start-click");
    void start.mutateAsync().finally(() => {
      startRequested.current = false;
    });
  };
  const requestPause = () => {
    if (pause.isPending) return;
    console.info("[argus] setup:pause-click");
    void pause.mutateAsync();
  };

  return (
    <div className="relative flex h-full flex-col">
      <div aria-hidden className="canvas-aurora" />

      <div className="relative mx-auto flex w-full max-w-[760px] flex-1 flex-col justify-center gap-10 px-8 py-16">
        <header className="reveal flex flex-col gap-4">
          <StatusBadge status={status} loading={isLoading} />
          <h1 className={t.h2}>
            {SETUP_COPY.title.map((line, i) => (
              <span key={i} className="block">
                {line}
              </span>
            ))}
          </h1>
          <p className={t.body}>{SETUP_COPY.body}</p>
          <DownloadTelemetry status={status} telemetry={telemetry} />
        </header>

        <ul className="reveal flex flex-col gap-2">
          {status.models.map((m) => (
            <ModelRow key={m.id} progress={m} />
          ))}
        </ul>

        <div className="reveal flex flex-col items-start gap-3">
          {allReady ? (
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-[14px] font-normal text-black hover:bg-white/90"
            >
              {SETUP_COPY.readyButton}
            </button>
          ) : anyActive ? (
            <button
              type="button"
              onClick={requestPause}
              disabled={pause.isPending}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-5 py-2.5 text-[14px] font-light text-white hover:border-white/25 hover:bg-white/[0.06]"
            >
              {SETUP_COPY.pauseButton}
            </button>
          ) : (
            <button
              type="button"
              onPointerUp={requestStart}
              onClick={requestStart}
              disabled={start.isPending}
              className="relative z-30 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-[14px] font-normal text-black hover:bg-white/90 disabled:opacity-50"
            >
              {hasResumable(status) ? SETUP_COPY.resumeButton : SETUP_COPY.startButton}
            </button>
          )}
          {(startError || pauseError) && (
            <p className="max-w-sm text-[12px] font-light leading-relaxed text-rose-300/80">
              {startError ?? pauseError}
            </p>
          )}
        </div>
      </div>

      <ProgressStrip fraction={status.fraction} />
    </div>
  );
}

const PLACEHOLDER: ModelsStatus = {
  ready: false,
  active: false,
  fraction: 0,
  models: [],
};

function hasResumable(s: ModelsStatus): boolean {
  return s.models.some((m) => m.downloadedBytes > 0 && m.state !== "ready");
}

interface DownloadTelemetryState {
  speedBytesPerSecond: number;
  etaSeconds: number | null;
}

function useDownloadTelemetry(status: ModelsStatus): DownloadTelemetryState {
  const previous = useRef<{ at: number; downloaded: number } | null>(null);
  const [speedBytesPerSecond, setSpeedBytesPerSecond] = useState(0);
  const downloaded = useMemo(
    () => status.models.reduce((sum, model) => sum + model.downloadedBytes, 0),
    [status.models],
  );
  const total = useMemo(
    () => status.models.reduce((sum, model) => sum + model.sizeBytes, 0),
    [status.models],
  );

  useEffect(() => {
    const now = performance.now();
    const prev = previous.current;
    previous.current = { at: now, downloaded };

    if (!status.active || !prev) {
      if (!status.active) setSpeedBytesPerSecond(0);
      return;
    }

    const seconds = (now - prev.at) / 1000;
    const delta = downloaded - prev.downloaded;
    if (seconds <= 0 || delta < 0) return;

    const instant = delta / seconds;
    setSpeedBytesPerSecond((current) =>
      current === 0 ? instant : current * 0.7 + instant * 0.3,
    );
  }, [downloaded, status.active]);

  const remaining = Math.max(0, total - downloaded);
  return {
    speedBytesPerSecond,
    etaSeconds:
      status.active && speedBytesPerSecond > 1024
        ? remaining / speedBytesPerSecond
        : null,
  };
}

function DownloadTelemetry({
  status,
  telemetry,
}: {
  status: ModelsStatus;
  telemetry: DownloadTelemetryState;
}) {
  if (status.models.length === 0) return null;
  if (status.ready) return null;

  const downloaded = status.models.reduce((sum, model) => sum + model.downloadedBytes, 0);
  const total = status.models.reduce((sum, model) => sum + model.sizeBytes, 0);
  const active = status.active || downloaded > 0;

  return (
    <div className="mt-2 flex w-max max-w-full flex-wrap items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <Metric label="Downloaded" value={`${formatSize(downloaded)} / ${formatSize(total)}`} />
      <span className="h-3 w-px bg-white/[0.08]" aria-hidden />
      <Metric
        label="Speed"
        value={active ? formatSpeed(telemetry.speedBytesPerSecond) : "Idle"}
        tone={status.active ? "text-amber-200" : undefined}
      />
      <span className="h-3 w-px bg-white/[0.08]" aria-hidden />
      <Metric
        label="Remaining"
        value={telemetry.etaSeconds === null ? "Calculating" : formatDuration(telemetry.etaSeconds)}
      />
    </div>
  );
}

function Metric({
  label,
  value,
  tone = "text-white/70",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <span className="flex items-baseline gap-2 whitespace-nowrap">
      <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-white/30">
        {label}
      </span>
      <span className={cn("font-mono text-[10.5px] uppercase tracking-[0.16em]", tone)}>
        {value}
      </span>
    </span>
  );
}

function StatusBadge({ status, loading }: { status: ModelsStatus; loading: boolean }) {
  const label = badgeLabel(status, loading);
  const tone = status.ready
    ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
    : status.active
      ? "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.85)] animate-pulse"
      : "bg-white/40";
  return (
    <span className="inline-flex w-max items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-white/65 font-mono">
      <span className={cn("h-1.5 w-1.5 rounded-full", tone)} />
      {label}
    </span>
  );
}

function badgeLabel(status: ModelsStatus, loading: boolean): string {
  if (loading && status.models.length === 0) return "Initialising";
  if (status.ready) return "Ready";
  if (!status.active) {
    const ready = status.models.filter((m) => m.state === "ready").length;
    if (ready === 0) return "Awaiting start";
    return `${ready} / ${status.models.length} ready`;
  }
  const active = status.models.find(
    (m) => m.state === "downloading" || m.state === "verifying",
  );
  const ready = status.models.filter((m) => m.state === "ready").length;
  const verb = active?.state === "verifying" ? "Verifying" : "Downloading";
  return `${verb} ${Math.min(ready + 1, status.models.length)} / ${status.models.length}`;
}

function ModelRow({ progress }: { progress: ModelProgress }) {
  const Icon = MODEL_ICONS[progress.id] ?? fallbackIcon;
  return (
    <li className="glass-card relative flex items-center gap-4 overflow-hidden rounded-xl px-5 py-3.5">
      <RowProgressFill progress={progress} />

      <span className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-white/[0.08] bg-white/[0.04]">
        <Icon size={16} className="text-white" />
      </span>

      <div className="relative z-10 min-w-0 flex-1">
        <div className="flex items-baseline gap-3">
          <span className="truncate text-[14px] font-light text-white">
            {progress.name}
          </span>
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/35">
            {formatSize(progress.sizeBytes)}
          </span>
        </div>
        <span className="text-[12.5px] font-extralight text-white/45">
          {progress.role}
        </span>
      </div>

      <div className="relative z-10 flex flex-col items-end gap-1.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/35">
          VRAM {progress.vram}
        </span>
        <RowState progress={progress} />
      </div>
    </li>
  );
}

function RowProgressFill({ progress }: { progress: ModelProgress }) {
  const pct =
    progress.sizeBytes === 0 ? 0 : progress.downloadedBytes / progress.sizeBytes;
  const visible =
    progress.state === "downloading" || progress.state === "verifying";
  return (
    <div
      aria-hidden
      className={cn(
        "absolute inset-y-0 left-0 transition-[width] duration-150 ease-linear",
        progress.state === "verifying"
          ? "bg-emerald-500/[0.06]"
          : "bg-amber-500/[0.07]",
        !visible && "opacity-0",
      )}
      style={{ width: `${Math.max(pct, progress.state === "verifying" ? 1 : 0) * 100}%` }}
    />
  );
}

const STATE_LABELS: Record<ModelState, string> = {
  queued: "Queued",
  downloading: "Downloading",
  verifying: "Verifying",
  ready: "Ready",
  error: "Error",
  paused: "Paused",
};

const STATE_TONE: Record<ModelState, string> = {
  queued: "text-white/35",
  downloading: "text-amber-300",
  verifying: "text-amber-200",
  ready: "text-emerald-300",
  error: "text-rose-300",
  paused: "text-white/55",
};

function RowState({ progress }: { progress: ModelProgress }) {
  if (progress.state === "downloading") {
    const pct = Math.round(
      progress.sizeBytes === 0 ? 0 : (progress.downloadedBytes / progress.sizeBytes) * 100,
    );
    return (
      <span className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-amber-300">
        {pct}%
      </span>
    );
  }
  return (
    <span
      className={cn(
        "font-mono text-[10.5px] uppercase tracking-[0.22em]",
        STATE_TONE[progress.state],
      )}
    >
      {STATE_LABELS[progress.state]}
    </span>
  );
}

function ProgressStrip({ fraction }: { fraction: number }) {
  const pct = Math.max(0, Math.min(1, fraction));
  return (
    <div
      className="relative mx-auto mb-6 h-[3px] w-[60%] max-w-[640px] overflow-hidden rounded-full bg-white/[0.05]"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct * 100)}
    >
      <div
        className="h-full rounded-full bg-gradient-to-r from-amber-500/40 via-amber-400 to-amber-300 shadow-[0_0_18px_rgba(245,158,11,0.55)] transition-[width] duration-200 ease-linear"
        style={{ width: `${pct * 100}%` }}
      />
    </div>
  );
}

function formatSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${Math.round(mb)} MB`;
}

function formatSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond <= 0) return "Measuring";
  return `${formatSize(bytesPerSecond)}/s`;
}

function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  if (safe < 60) return `${safe}s`;
  const minutes = Math.floor(safe / 60);
  const remainder = safe % 60;
  if (minutes < 60) return `${minutes}m ${remainder.toString().padStart(2, "0")}s`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins.toString().padStart(2, "0")}m`;
}
