import { ArrowUpRight, Cancel, Tick } from "@/renderer/design/icons";
import { cn } from "@/renderer/lib/cn";
import type { ReviewRecord } from "@/shared/types/verdict";

export function ReviewList({
  records,
  empty,
  onApprove,
  onBlock,
  busyId,
}: {
  records: ReviewRecord[];
  empty: string;
  onApprove?: (id: string) => void;
  onBlock?: (id: string) => void;
  busyId?: string | null;
}) {
  if (records.length === 0) {
    return (
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-6 text-[13px] font-light leading-[1.65] text-white/45">
        {empty}
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2.5">
      {records.map((record) => (
        <li
          key={record.id}
          className="rounded-2xl border border-white/[0.07] bg-[#0a0a0c] p-4 shadow-[0_24px_70px_-46px_rgba(0,0,0,0.9)]"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Status status={record.status} />
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/28">
                  {formatDate(record.updatedAt)}
                </span>
              </div>
              <h3 className="truncate text-[15px] font-light text-white">
                {record.verdict.explanation.title}
              </h3>
              <p className="mt-1 line-clamp-2 text-[12.5px] font-light leading-[1.55] text-white/48">
                {record.verdict.summary}
              </p>
              {record.signature && (
                <a
                  href={`https://solscan.io/tx/${record.signature}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.15em] text-emerald-200/80 hover:text-white"
                >
                  Solscan
                  <ArrowUpRight size={12} />
                </a>
              )}
            </div>

            {record.status === "pending" && onApprove && onBlock && (
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  disabled={busyId === record.id}
                  onClick={() => onApprove(record.id)}
                  className="inline-flex cursor-pointer items-center justify-center rounded-lg bg-white px-3 py-2 text-[12px] font-normal text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={busyId === record.id}
                  onClick={() => onBlock(record.id)}
                  className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-2 text-[12px] font-light text-white/70 transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Block
                </button>
              </div>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function Status({ status }: { status: ReviewRecord["status"] }) {
  const Icon = status === "signed" ? Tick : status === "blocked" ? Cancel : null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-1 font-mono text-[9.5px] uppercase tracking-[0.16em]",
        status === "signed" &&
          "border-emerald-400/20 bg-emerald-500/[0.07] text-emerald-200",
        status === "blocked" &&
          "border-rose-400/20 bg-rose-500/[0.07] text-rose-200",
        status === "pending" &&
          "border-amber-400/20 bg-amber-500/[0.07] text-amber-200",
      )}
    >
      {Icon && <Icon size={11} />}
      {status}
    </span>
  );
}

function formatDate(ms: number): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(ms));
}
