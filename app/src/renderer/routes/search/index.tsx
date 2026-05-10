import { useState } from "react";
import { FileSearch } from "@/renderer/design/icons";
import { type as t } from "@/renderer/design/tokens";
import { useReviewSearch } from "@/renderer/hooks/use-review";
import { ReviewList } from "@/renderer/routes/shared/review-list";

export default function SearchRoute() {
  const [query, setQuery] = useState("");
  const results = useReviewSearch(query);

  return (
    <div className="relative flex h-full flex-col">
      <div aria-hidden className="canvas-aurora" />
      <main className="relative mx-auto flex w-full max-w-[860px] flex-1 flex-col gap-8 px-8 py-12">
        <header className="flex flex-col gap-3">
          <span className={t.eyebrow}>Search</span>
          <h1 className={t.h2}>Ask your wallet history.</h1>
          <p className={t.body}>
            Search verdicts, citations, signatures, and statuses locally. RAG can
            layer on later without changing the surface.
          </p>
        </header>

        <label className="relative block">
          <FileSearch
            size={16}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/38"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value.slice(0, 160))}
            maxLength={160}
            placeholder="search approvals, blocked reviews, Jupiter, simulation..."
            className="h-12 w-full rounded-xl border border-white/[0.08] bg-white/[0.025] pl-11 pr-4 text-[14px] font-light text-white placeholder:text-white/26 outline-none transition focus:border-white/22 focus:bg-white/[0.04]"
          />
        </label>

        {results.isError && (
          <div className="rounded-xl border border-rose-500/25 bg-rose-500/[0.06] p-4 text-[13px] font-light text-rose-200">
            {results.error.message}
          </div>
        )}

        <ReviewList
          records={results.data ?? []}
          empty={query.trim() ? "No local results matched that search." : "No review records yet. Review a transaction first, then search becomes useful."}
        />
      </main>
    </div>
  );
}
