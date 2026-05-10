import { type as t } from "@/renderer/design/tokens";

/** A single empty-state component reused by every not-yet-built route. */
export function PlaceholderRoute({
  title,
  body,
  marker,
}: {
  title: string;
  body: string;
  marker: string;
}) {
  return (
    <div className="mx-auto flex h-full max-w-[640px] flex-col justify-center gap-4 px-6 py-16">
      <span className={t.eyebrow}>
        {marker}
        <span className="w-6 h-px bg-white/15" aria-hidden />
        Not built yet
      </span>
      <h1 className={t.h2}>{title}</h1>
      <p className={t.body}>{body}</p>
    </div>
  );
}
