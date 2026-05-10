import { useState } from "react";
import { ArrowRight, Cancel, View, ViewOff } from "@/renderer/design/icons";
import { type as t } from "@/renderer/design/tokens";
import { cn } from "@/renderer/lib/cn";
import { useUi } from "@/renderer/stores/ui";
import { WELCOME_COPY } from "@/renderer/content/welcome";
import {
  useConfirmCreateWallet,
  useImportWallet,
  useUnlockWallet,
  useWallet,
} from "@/renderer/hooks/use-wallet";

type Step =
  | { kind: "intro" }
  | { kind: "passphrase"; mode: "create" | "import" }
  | { kind: "reveal"; mnemonic: string[]; address: string }
  | { kind: "import"; passphrase: string };

export default function WelcomeRoute() {
  const wallet = useWallet();
  const [step, setStep] = useState<Step>({ kind: "intro" });

  // Locked wallet: just unlock — skip the intro entirely.
  if (wallet.data?.state === "locked") return <UnlockStep />;

  if (step.kind === "passphrase") {
    return (
      <PassphraseStep
        mode={step.mode}
        onBack={() => setStep({ kind: "intro" })}
        onNext={(passphrase) => {
          if (step.mode === "import") setStep({ kind: "import", passphrase });
          else void runCreate(passphrase, setStep);
        }}
      />
    );
  }
  if (step.kind === "reveal") {
    return <RevealStep mnemonic={step.mnemonic} address={step.address} />;
  }
  if (step.kind === "import") {
    return <ImportStep passphrase={step.passphrase} />;
  }
  return <IntroStep onPick={(mode) => setStep({ kind: "passphrase", mode })} />;
}

// ---------------------------------------------------------------------------
// Step 0 — pick a path
// ---------------------------------------------------------------------------

function IntroStep({ onPick }: { onPick: (m: "create" | "import") => void }) {
  return (
    <Frame>
      <Eyebrow>{WELCOME_COPY.intro.eyebrow}</Eyebrow>
      <h1 className={t.h2}>
        {WELCOME_COPY.intro.title.map((line, i) => (
          <span key={i} className="block">
            {line}
          </span>
        ))}
      </h1>
      <p className={t.body}>{WELCOME_COPY.intro.body}</p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <PrimaryButton onClick={() => onPick("create")}>
          {WELCOME_COPY.intro.create}
          <ArrowRight size={14} className="text-black/60" />
        </PrimaryButton>
        <SecondaryButton onClick={() => onPick("import")}>
          {WELCOME_COPY.intro.import}
        </SecondaryButton>
      </div>
    </Frame>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — passphrase capture
// ---------------------------------------------------------------------------

function PassphraseStep({
  mode,
  onBack,
  onNext,
}: {
  mode: "create" | "import";
  onBack: () => void;
  onNext: (passphrase: string) => void;
}) {
  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const valid = pass.length >= 8 && pass === confirm;
  const showMismatch = confirm.length > 0 && pass !== confirm;

  return (
    <Frame>
      <Eyebrow>{mode === "create" ? "Step 1 of 2" : "Step 1 of 2"}</Eyebrow>
      <h1 className={t.h2}>{WELCOME_COPY.passphrase.title}</h1>
      <p className={t.body}>{WELCOME_COPY.passphrase.body}</p>

      <form
        className="mt-4 flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) onNext(pass);
        }}
      >
        <Field
          label={WELCOME_COPY.passphrase.field}
          type="password"
          value={pass}
          onChange={setPass}
          autoFocus
        />
        <Field
          label={WELCOME_COPY.passphrase.confirm}
          type="password"
          value={confirm}
          onChange={setConfirm}
          error={showMismatch ? WELCOME_COPY.passphrase.mismatch : null}
        />
        <p className="text-[12px] font-extralight text-white/40">
          {WELCOME_COPY.passphrase.rule}
        </p>

        <div className="mt-2 flex gap-3">
          <SecondaryButton onClick={onBack} type="button">
            {WELCOME_COPY.passphrase.back}
          </SecondaryButton>
          <PrimaryButton type="submit" disabled={!valid}>
            {WELCOME_COPY.passphrase.next}
            <ArrowRight size={14} className="text-black/60" />
          </PrimaryButton>
        </div>
      </form>
    </Frame>
  );
}

async function runCreate(
  passphrase: string,
  setStep: (s: Step) => void,
): Promise<void> {
  // Imperative escape from the form — inline so the wizard stays a single
  // file. Once the API stabilises we'll move to a useReducer.
  const { argus } = await import("@/renderer/ipc/client");
  const { mnemonic, address } = await argus.wallet.create({ passphrase });
  setStep({ kind: "reveal", mnemonic, address });
}

// ---------------------------------------------------------------------------
// Step 2a — reveal mnemonic (create flow)
// ---------------------------------------------------------------------------

function RevealStep({ mnemonic, address }: { mnemonic: string[]; address: string }) {
  const [stored, setStored] = useState(false);
  const confirm = useConfirmCreateWallet();
  const setRoute = useUi((s) => s.setRoute);

  return (
    <Frame>
      <Eyebrow>{WELCOME_COPY.reveal.eyebrow}</Eyebrow>
      <h1 className={t.h2}>{WELCOME_COPY.reveal.title}</h1>
      <p className={t.body}>{WELCOME_COPY.reveal.body}</p>

      <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl border border-white/[0.07] bg-[#0a0a0c] p-4 sm:grid-cols-4">
        {mnemonic.map((word, i) => (
          <div
            key={i}
            className="flex items-baseline gap-2 rounded-md border border-white/[0.05] bg-white/[0.02] px-3 py-2"
          >
            <span className="font-mono text-[10px] tabular-nums text-white/30">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="font-mono text-[13px] text-white/85">{word}</span>
          </div>
        ))}
      </div>

      <p className="mt-3 break-all font-mono text-[11px] uppercase tracking-[0.16em] text-white/35">
        Address · {address}
      </p>

      <label className="mt-4 flex cursor-pointer items-center gap-3 select-none">
        <input
          type="checkbox"
          checked={stored}
          onChange={(e) => setStored(e.target.checked)}
          className="h-4 w-4 cursor-pointer accent-emerald-400"
        />
        <span className="text-[13.5px] text-white/75">{WELCOME_COPY.reveal.confirm}</span>
      </label>

      <div className="mt-4">
        <PrimaryButton
          disabled={!stored || confirm.isPending}
          onClick={() =>
            confirm.mutate(undefined, {
              onSuccess: () => setRoute("setup"),
            })
          }
        >
          {WELCOME_COPY.reveal.finish}
          <ArrowRight size={14} className="text-black/60" />
        </PrimaryButton>
      </div>
    </Frame>
  );
}

// ---------------------------------------------------------------------------
// Step 2b — paste mnemonic (import flow)
// ---------------------------------------------------------------------------

function ImportStep({ passphrase }: { passphrase: string }) {
  const [phrase, setPhrase] = useState("");
  const importMutation = useImportWallet();
  const setRoute = useUi((s) => s.setRoute);
  const words = phrase.trim().split(/\s+/).filter(Boolean);
  const valid = words.length === 12 || words.length === 24;
  const error = importMutation.error?.message ?? null;

  return (
    <Frame>
      <Eyebrow>Step 2 of 2</Eyebrow>
      <h1 className={t.h2}>{WELCOME_COPY.importStep.title}</h1>
      <p className={t.body}>{WELCOME_COPY.importStep.body}</p>

      <textarea
        value={phrase}
        onChange={(e) => setPhrase(e.target.value)}
        placeholder={WELCOME_COPY.importStep.placeholder}
        rows={4}
        spellCheck={false}
        autoCapitalize="none"
        autoCorrect="off"
        className="mt-4 w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 font-mono text-[13.5px] text-white placeholder:text-white/25 focus:border-white/30 focus:bg-white/[0.04] focus:outline-none"
      />
      <p className="mt-2 text-[11.5px] font-mono uppercase tracking-[0.18em] text-white/35">
        {words.length} / 12 words
      </p>
      {error && (
        <p className="mt-2 text-[12px] font-light text-rose-300/85">{error}</p>
      )}

      <div className="mt-4">
        <PrimaryButton
          disabled={!valid || importMutation.isPending}
          onClick={() =>
            importMutation.mutate(
              { mnemonic: words, passphrase },
              { onSuccess: () => setRoute("setup") },
            )
          }
        >
          {WELCOME_COPY.importStep.next}
          <ArrowRight size={14} className="text-black/60" />
        </PrimaryButton>
      </div>
    </Frame>
  );
}

// ---------------------------------------------------------------------------
// Unlock — wallet exists but is locked
// ---------------------------------------------------------------------------

function UnlockStep() {
  const [pass, setPass] = useState("");
  const unlock = useUnlockWallet();
  const setRoute = useUi((s) => s.setRoute);
  const error = unlock.error?.message ?? null;

  return (
    <Frame>
      <Eyebrow>{WELCOME_COPY.unlock.eyebrow}</Eyebrow>
      <h1 className={t.h2}>{WELCOME_COPY.unlock.title}</h1>
      <p className={t.body}>{WELCOME_COPY.unlock.body}</p>

      <form
        className="mt-4 flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (pass.length === 0) return;
          unlock.mutate(
            { passphrase: pass },
            { onSuccess: () => setRoute("review") },
          );
        }}
      >
        <Field
          label={WELCOME_COPY.unlock.field}
          type="password"
          value={pass}
          onChange={setPass}
          autoFocus
          error={error}
        />
        <p className="text-[12px] font-extralight text-white/40">
          {WELCOME_COPY.unlock.forgot}
        </p>
        <div>
          <PrimaryButton
            type="submit"
            disabled={pass.length === 0 || unlock.isPending}
          >
            {WELCOME_COPY.unlock.next}
            <ArrowRight size={14} className="text-black/60" />
          </PrimaryButton>
        </div>
      </form>
    </Frame>
  );
}

// ---------------------------------------------------------------------------
// Shared shell + tiny form primitives
// ---------------------------------------------------------------------------

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex h-full flex-col">
      <div aria-hidden className="canvas-aurora" />
      <div className="relative mx-auto flex w-full max-w-[640px] flex-1 flex-col justify-center gap-4 px-8 py-16">
        {children}
      </div>
    </div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <span className={t.eyebrow}>{children}</span>;
}

function Field({
  label,
  type,
  value,
  onChange,
  error = null,
  autoFocus = false,
}: {
  label: string;
  type: "text" | "password";
  value: string;
  onChange: (v: string) => void;
  error?: string | null;
  autoFocus?: boolean;
}) {
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === "password";
  const effective = isPassword && revealed ? "text" : type;
  const Eye = revealed ? ViewOff : View;

  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45">
        {label}
      </span>
      <div
        className={cn(
          "relative flex items-center rounded-xl border bg-white/[0.02] focus-within:bg-white/[0.04]",
          error
            ? "border-rose-400/40 focus-within:border-rose-400/60"
            : "border-white/[0.08] focus-within:border-white/30",
        )}
      >
        <input
          type={effective}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoFocus={autoFocus}
          // Hint password managers / autofill that this is a freshly-set
          // wallet passphrase, not a remote-account password.
          autoComplete={isPassword ? "new-password" : undefined}
          spellCheck={false}
          className={cn(
            "w-full bg-transparent px-4 py-2.5 text-[14px] text-white outline-none",
            isPassword && "pr-11",
          )}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            tabIndex={-1}
            aria-label={revealed ? "Hide passphrase" : "Show passphrase"}
            aria-pressed={revealed}
            className="absolute right-2 flex h-8 w-8 items-center justify-center rounded-md text-white/45 transition-colors hover:bg-white/[0.05] hover:text-white/80"
          >
            <Eye size={16} />
          </button>
        )}
      </div>
      {error && (
        <span className="flex items-center gap-1.5 text-[12px] text-rose-300/85">
          <Cancel size={12} className="text-rose-300" />
          {error}
        </span>
      )}
    </label>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-[14px] font-normal text-black hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function SecondaryButton({
  children,
  onClick,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-5 py-2.5 text-[14px] font-light text-white hover:border-white/25 hover:bg-white/[0.06]"
    >
      {children}
    </button>
  );
}

