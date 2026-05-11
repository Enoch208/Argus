import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Cancel } from "@/renderer/design/icons";
import { type as t } from "@/renderer/design/tokens";
import { cn } from "@/renderer/lib/cn";
import { REVIEW_COPY } from "@/renderer/content/review";
import { VerdictCard } from "@/renderer/components/verdict/verdict-card";
import { VoiceCommand } from "@/renderer/components/verdict/voice-command";
import {
  useApproveReview,
  useBlockReview,
  useReview,
} from "@/renderer/hooks/use-review";

type ImageMime = "image/png" | "image/jpeg" | "image/webp";

interface ReviewImage {
  base64: string;
  mime: ImageMime;
  /** Object URL for the preview thumbnail; revoked on remove / unmount. */
  preview: string;
  /** Display label, e.g. "screenshot.png · 482 KB". */
  label: string;
}

const ACCEPTED_MIME: readonly ImageMime[] = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;
const MIN_TRANSACTION_BASE58_CHARS = 120;

export default function ReviewRoute() {
  const [raw, setRaw] = useState("");
  const [image, setImage] = useState<ReviewImage | null>(null);
  const [reviewHasTransaction, setReviewHasTransaction] = useState(false);
  const review = useReview();
  const approve = useApproveReview();
  const block = useBlockReview();
  const dropRef = useRef<HTMLDivElement | null>(null);
  const [dropActive, setDropActive] = useState(false);

  const trimmedText = raw.trim();
  const rawLooksInformational =
    trimmedText.length > 0 &&
    isBase58(trimmedText) &&
    !looksLikeBase58(trimmedText);
  const hasText = trimmedText.length > 0;
  const hasTransaction = looksLikeBase58(trimmedText);
  const valid = hasText || image !== null;
  const actionPending = approve.isPending || block.isPending;
  const verdictId = review.data?.id;

  const onVoiceAction = useCallback(
    (action: "approve" | "block") => {
      if (!verdictId) return;
      if (actionPending || approve.isSuccess || block.isSuccess) return;
      if (action === "approve") approve.mutate({ id: verdictId });
      else block.mutate({ id: verdictId });
    },
    [verdictId, actionPending, approve, block],
  );

  // Window-level Cmd+V paste capture for images. Pastes into the textarea
  // still flow as text via the input's own onChange; image clipboard items
  // would otherwise be ignored.
  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      const item = pickImageItem(event.clipboardData);
      if (!item) return;
      const file = item.getAsFile();
      if (!file) return;
      event.preventDefault();
      void readImageFile(file).then(setImage);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  // Revoke object URL on unmount or replacement so we don't leak memory.
  useEffect(() => {
    return () => {
      if (image) URL.revokeObjectURL(image.preview);
    };
  }, [image]);

  return (
    <div className="relative flex h-full flex-col">
      <div aria-hidden className="canvas-aurora" />

      <div className="relative mx-auto flex w-full max-w-[820px] flex-1 flex-col gap-8 px-8 py-12">
        <header className="flex flex-col gap-3">
          <h1 className={t.h2}>{REVIEW_COPY.title[0]}</h1>
          <p className={cn(t.body, "max-w-[560px]")}>{REVIEW_COPY.body}</p>
        </header>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!valid) return;
            approve.reset();
            block.reset();
            setReviewHasTransaction(hasTransaction);
            review.mutate({
              ...(hasTransaction ? { raw: trimmedText } : {}),
              ...(!hasTransaction && hasText ? { text: trimmedText } : {}),
              ...(image
                ? { image: { base64: image.base64, mime: image.mime } }
                : {}),
            });
          }}
          className="flex flex-col gap-4"
        >
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45">
              {REVIEW_COPY.pasteLabel}
            </span>
            <textarea
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder={REVIEW_COPY.placeholder}
              spellCheck={false}
              autoCapitalize="none"
              autoCorrect="off"
              rows={4}
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 font-mono text-[12.5px] text-white placeholder:text-white/25 focus:border-white/30 focus:bg-white/[0.04] focus:outline-none"
            />
            {rawLooksInformational && (
              <span className="text-[11.5px] font-light text-amber-100/70">
                That looks like an address or transaction ID. Argus can check it
                for risk, but there will be nothing to approve or sign.
              </span>
            )}
          </label>

          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45">
              {REVIEW_COPY.imageLabel}
            </span>
            {image ? (
              <ImagePreview image={image} onRemove={() => setImage(null)} />
            ) : (
              <div
                ref={dropRef}
                onDragEnter={(e) => {
                  e.preventDefault();
                  setDropActive(true);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDropActive(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setDropActive(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDropActive(false);
                  const file = pickImageFile(e.dataTransfer.files);
                  if (file) void readImageFile(file).then(setImage);
                }}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed bg-white/[0.015] px-4 py-8 text-center text-[13px] transition-colors",
                  dropActive
                    ? "border-emerald-300/40 bg-emerald-500/[0.04] text-emerald-200/80"
                    : "border-white/15 text-white/45 hover:border-white/25 hover:bg-white/[0.03]",
                )}
              >
                <span>{REVIEW_COPY.imageEmpty}</span>
                <span className="text-[11px] text-white/30">
                  {REVIEW_COPY.imageHint}
                </span>
              </div>
            )}
          </div>

          <div>
            <button
              type="submit"
              disabled={!valid || review.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-[14px] font-normal text-black hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {review.isPending
                ? REVIEW_COPY.reviewing
                : REVIEW_COPY.reviewButton}
              {!review.isPending && (
                <ArrowRight size={14} className="text-black/60" />
              )}
            </button>
          </div>
        </form>

        <section className="flex flex-col gap-4">
          {review.isError && (
            <div className="rounded-xl border border-rose-500/25 bg-rose-500/[0.06] p-4 text-[13px] font-light text-rose-200">
              {review.error.message}
            </div>
          )}
          {review.data ? (
            <>
              <VerdictCard verdict={review.data} />
              {reviewHasTransaction ? (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      disabled={
                        actionPending || approve.isSuccess || block.isSuccess
                      }
                      onClick={() => approve.mutate({ id: review.data.id })}
                      className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-white/20 bg-white px-5 py-2.5 text-[13px] font-normal text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_16px_40px_-24px_rgba(255,255,255,0.9)] transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {approve.isPending
                        ? "Signing..."
                        : REVIEW_COPY.approveButton}
                    </button>
                    <button
                      type="button"
                      disabled={
                        actionPending || approve.isSuccess || block.isSuccess
                      }
                      onClick={() => block.mutate({ id: review.data.id })}
                      className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-white/[0.12] bg-white/[0.03] px-5 py-2.5 text-[13px] font-normal text-white/82 transition hover:border-white/22 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {block.isPending
                        ? "Blocking..."
                        : REVIEW_COPY.blockButton}
                    </button>
                    <VoiceCommand
                      disabled={
                        actionPending || approve.isSuccess || block.isSuccess
                      }
                      onAction={onVoiceAction}
                    />
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 text-[13px] font-light text-white/55">
                  Screenshot-only review. No transaction was submitted to sign.
                </div>
              )}
              {approve.isSuccess && (
                <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/[0.06] p-4 text-[13px] font-light text-emerald-100">
                  Broadcasted ·{" "}
                  <a
                    href={`https://solscan.io/tx/${approve.data.signature}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-emerald-200 underline decoration-emerald-300/30 underline-offset-4 hover:text-white"
                  >
                    {shortSignature(approve.data.signature)}
                  </a>
                </div>
              )}
              {block.isSuccess && (
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 text-[13px] font-light text-white/60">
                  Blocked locally. Nothing was signed.
                </div>
              )}
              {approve.isError && (
                <div className="rounded-xl border border-rose-500/25 bg-rose-500/[0.06] p-4 text-[13px] font-light text-rose-200">
                  {approve.error.message}
                </div>
              )}
              {block.isError && (
                <div className="rounded-xl border border-rose-500/25 bg-rose-500/[0.06] p-4 text-[13px] font-light text-rose-200">
                  {block.error.message}
                </div>
              )}
            </>
          ) : (
            !review.isError && (
              <p className={cn(t.bodySm, "italic")}>{REVIEW_COPY.emptyHint}</p>
            )
          )}
        </section>
      </div>
    </div>
  );
}

function shortSignature(signature: string): string {
  if (signature.length <= 18) return signature;
  return `${signature.slice(0, 8)}...${signature.slice(-8)}`;
}

// ---------------------------------------------------------------------------
// Image helpers
// ---------------------------------------------------------------------------

function looksLikeBase58(s: string): boolean {
  const t = s.trim();
  return t.length >= MIN_TRANSACTION_BASE58_CHARS && isBase58(t);
}

function isBase58(s: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]+$/.test(s.trim());
}

function pickImageItem(data: DataTransfer | null): DataTransferItem | null {
  if (!data) return null;
  for (const item of data.items) {
    if (
      item.kind === "file" &&
      (ACCEPTED_MIME as readonly string[]).includes(item.type)
    ) {
      return item;
    }
  }
  return null;
}

function pickImageFile(files: FileList): File | null {
  for (const f of files) {
    if ((ACCEPTED_MIME as readonly string[]).includes(f.type)) return f;
  }
  return null;
}

async function readImageFile(file: File): Promise<ReviewImage> {
  const buf = await file.arrayBuffer();
  const base64 = arrayBufferToBase64(buf);
  return {
    base64,
    mime: file.type as ImageMime,
    preview: URL.createObjectURL(file),
    label: `${file.name || "screenshot"} · ${formatBytes(file.size)}`,
  };
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  // Avoid `btoa(String.fromCharCode(...new Uint8Array(buffer)))` — it stack-
  // overflows on large screenshots. Chunk through `String.fromCharCode`.
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function ImagePreview({
  image,
  onRemove,
}: {
  image: ReviewImage;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/[0.1] bg-white/[0.03] p-3">
      <img
        src={image.preview}
        alt="Pasted screenshot"
        className="h-16 w-16 shrink-0 rounded-md border border-white/10 object-cover"
      />
      <div className="min-w-0 flex-1">
        <div className="font-mono text-[11.5px] tracking-wide text-white/70 truncate">
          {image.label}
        </div>
        <div className="mt-0.5 text-[11px] text-white/40">
          OCR will extract URLs and visible text on Review.
        </div>
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[11px] font-light text-white/70 transition-colors hover:border-white/20 hover:bg-white/[0.07] hover:text-white"
      >
        <Cancel size={11} />
        {REVIEW_COPY.imageRemove}
      </button>
    </div>
  );
}
