import { useQuery } from "@tanstack/react-query";
import { MODEL_ICONS, fallbackIcon } from "@/renderer/content/setup";
import {
  Activity,
  Bot,
  Earth,
  FileSearch,
  FingerPrint,
  Shield,
  Sparkles,
  VolumeHigh,
  Wallet,
  type Icon,
} from "@/renderer/design/icons";
import { type as t } from "@/renderer/design/tokens";
import { useModels } from "@/renderer/hooks/use-models";
import { argus } from "@/renderer/ipc/client";
import { cn } from "@/renderer/lib/cn";
import type {
  ModelProgress,
  ModelState,
  StackLayer,
  StackLayerState,
} from "@/shared/ipc";

export default function StackRoute() {
  const models = useModels();
  const stack = useQuery({
    queryKey: ["stack", "status"],
    queryFn: () => argus.stack.status(),
    refetchInterval: 5000,
  });

  const status = models.data;
  const stackStatus = stack.data;
  const ready = status?.models.filter((m) => m.state === "ready").length ?? 0;
  const total = status?.models.length ?? 0;
  const protectionReady =
    stackStatus?.layers.filter((layer) => layer.state === "ready").length ?? 0;
  const protectionTotal = stackStatus?.layers.length ?? 6;

  return (
    <div className="relative flex h-full flex-col">
      <div aria-hidden className="canvas-aurora" />
      <main className="relative mx-auto flex w-full max-w-[980px] flex-1 flex-col gap-7 px-8 py-12">
        <header className="flex flex-col gap-3">
          <span className={t.eyebrow}>Stack</span>
          <h1 className={t.h2}>
            {stackStatus?.ready ? "Argus is ready." : "Argus is getting ready."}
          </h1>
          <p className={t.body}>
            The protections Argus uses before you sign, check a site, or review
            a suspicious screenshot.
          </p>
        </header>

        <section className="grid gap-3 md:grid-cols-4">
          <SummaryCard
            icon={Shield}
            label="Protection"
            value={`${protectionReady} / ${protectionTotal}`}
          />
          <SummaryCard
            icon={Sparkles}
            label="Models"
            value={`${ready} / ${total || 4}`}
          />
          <SummaryCard
            icon={Earth}
            label="Scam domains"
            value={formatCount(stackStatus?.scamDomains)}
          />
          <SummaryCard
            icon={Wallet}
            label="Blocked wallets"
            value={formatCount(stackStatus?.blacklistedWallets)}
          />
        </section>

        <section className="grid gap-3 md:grid-cols-2">
          {(stackStatus?.layers ?? previewLayers).map((layer) => (
            <ProtectionLayerCard key={layer.id} layer={layer} />
          ))}
        </section>

        <section className="rounded-2xl border border-white/[0.07] bg-[#0a0a0c] p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-[15px] font-light text-white">Diagnostics</h2>
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/35">
              Local runtime
            </span>
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            <DiagnosticCard
              label="Model inventory"
              value={`${ready} ready`}
              detail={`${total || 4} local models checked on launch`}
            />
            <DiagnosticCard
              label="Scam intel store"
              value="SQLite"
              detail="On-device exact-match lookups"
            />
            <DiagnosticCard
              label="Review mode"
              value="Flexible"
              detail="Transaction, URL, address, text, or screenshot"
            />
          </div>
        </section>

        <section className="rounded-2xl border border-white/[0.07] bg-[#0a0a0c] p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-[15px] font-light text-white">
              On-device models
            </h2>
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/35">
              Integrity checked on launch
            </span>
          </div>
          <ul className="flex flex-col gap-2">
            {(status?.models ?? []).map((model) => (
              <ModelStackRow key={model.id} model={model} />
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}

const LAYER_ICONS: Record<string, Icon> = {
  "transaction-decoder": FingerPrint,
  "screenshot-ocr": FileSearch,
  "scam-domains": Earth,
  "wallet-blacklist": Wallet,
  "local-ai": Bot,
  voice: VolumeHigh,
};

const previewLayers: StackLayer[] = [
  {
    id: "transaction-decoder",
    label: "Transaction decoder",
    state: "loading",
    value: "Checking",
    detail: "Waiting for the app runtime status.",
  },
];

function SummaryCard({
  icon: Icon,
  label,
  value,
}: {
  icon: Icon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
      <Icon size={16} className="mb-5 text-white/62" />
      <span className="block font-mono text-[10px] uppercase tracking-[0.18em] text-white/32">
        {label}
      </span>
      <span className="mt-1 block text-[18px] font-light text-white">
        {value}
      </span>
    </div>
  );
}

function ProtectionLayerCard({ layer }: { layer: StackLayer }) {
  const Icon = LAYER_ICONS[layer.id] ?? Activity;
  return (
    <article className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.035]">
          <Icon size={17} className="text-white/75" />
        </span>
        <StatePill state={layer.state} />
      </div>
      <div className="mt-5">
        <span className="block text-[13px] font-light text-white/65">
          {layer.label}
        </span>
        <strong className="mt-1 block text-[22px] font-light text-white">
          {layer.value}
        </strong>
        <p className="mt-2 min-h-10 text-[12.5px] font-light leading-[1.55] text-white/42">
          {layer.detail}
        </p>
      </div>
    </article>
  );
}

function StatePill({ state }: { state: StackLayerState }) {
  return (
    <span
      className={cn(
        "rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em]",
        layerTone(state),
      )}
    >
      {state}
    </span>
  );
}

function DiagnosticCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
      <span className="block font-mono text-[10px] uppercase tracking-[0.16em] text-white/32">
        {label}
      </span>
      <span className="mt-2 block text-[16px] font-light text-white">
        {value}
      </span>
      <span className="mt-1 block text-[12px] font-light text-white/40">
        {detail}
      </span>
    </div>
  );
}

function ModelStackRow({ model }: { model: ModelProgress }) {
  const Icon = MODEL_ICONS[model.id] ?? fallbackIcon;
  return (
    <li className="flex items-center gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.035]">
        <Icon size={16} className="text-white/78" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-[13.5px] font-light text-white">
            {model.name}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/28">
            {formatSize(model.sizeBytes)}
          </span>
        </div>
        <span className="text-[12px] font-light text-white/42">
          {model.role}
        </span>
      </div>
      <span
        className={cn(
          "font-mono text-[10px] uppercase tracking-[0.18em]",
          stateTone(model.state),
        )}
      >
        {model.state}
      </span>
    </li>
  );
}

function stateTone(state: ModelState): string {
  if (state === "ready") return "text-emerald-300";
  if (state === "downloading" || state === "verifying") return "text-amber-300";
  if (state === "error") return "text-rose-300";
  return "text-white/36";
}

function layerTone(state: StackLayerState): string {
  if (state === "ready") {
    return "border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-200";
  }
  if (state === "attention") {
    return "border-rose-400/25 bg-rose-400/[0.08] text-rose-200";
  }
  return "border-amber-400/20 bg-amber-400/[0.07] text-amber-200";
}

function formatSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${Math.round(mb)} MB`;
}

function formatCount(value: number | undefined): string {
  if (value === undefined) return "Loading";
  return Intl.NumberFormat("en").format(value);
}
