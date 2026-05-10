import { MODEL_ICONS, fallbackIcon } from "@/renderer/content/setup";
import { Activity, Shield, Sparkles, type Icon } from "@/renderer/design/icons";
import { type as t } from "@/renderer/design/tokens";
import { useModels } from "@/renderer/hooks/use-models";
import { cn } from "@/renderer/lib/cn";
import type { ModelProgress, ModelState } from "@/shared/ipc";

export default function StackRoute() {
  const models = useModels();
  const status = models.data;
  const ready = status?.models.filter((m) => m.state === "ready").length ?? 0;
  const total = status?.models.length ?? 0;

  return (
    <div className="relative flex h-full flex-col">
      <div aria-hidden className="canvas-aurora" />
      <main className="relative mx-auto flex w-full max-w-[920px] flex-1 flex-col gap-8 px-8 py-12">
        <header className="flex flex-col gap-3">
          <span className={t.eyebrow}>Stack</span>
          <h1 className={t.h2}>Local trust stack.</h1>
          <p className={t.body}>
            Model integrity, local intelligence, and runtime readiness in one
            operational view.
          </p>
        </header>

        <section className="grid gap-3 md:grid-cols-3">
          <SummaryCard icon={Sparkles} label="Models" value={`${ready} / ${total || 6}`} />
          <SummaryCard icon={Shield} label="Scam intel" value="SQLite local" />
          <SummaryCard
            icon={Activity}
            label="Explainer"
            value={status?.models.find((m) => m.id === "qwen3-1-7b-q4")?.state ?? "queued"}
          />
        </section>

        <section className="rounded-2xl border border-white/[0.07] bg-[#0a0a0c] p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-[15px] font-light text-white">On-device models</h2>
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
      <span className="mt-1 block text-[18px] font-light capitalize text-white">
        {value}
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
        <span className="text-[12px] font-light text-white/42">{model.role}</span>
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

function formatSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${Math.round(mb)} MB`;
}
