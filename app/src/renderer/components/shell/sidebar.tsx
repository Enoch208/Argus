import { useUi, type Route } from "@/renderer/stores/ui";
import {
  ArrowUpRight,
  Bot,
  FileSearch,
  Layers,
  ShieldStrong,
  Sphere,
  View,
  Wallet,
  type Icon,
} from "@/renderer/design/icons";
import { SHORTCUTS } from "@/renderer/hooks/use-shortcuts";
import { useWallet, useWalletBalance } from "@/renderer/hooks/use-wallet";
import { cn } from "@/renderer/lib/cn";

interface NavItem {
  route: Route;
  label: string;
  icon: Icon;
}

// One row of the sidebar = one route. Order locked.
// Shortcut labels come from SHORTCUTS so the chip can never drift from the
// actually-registered hotkey.
const ITEMS: NavItem[] = [
  { route: "review", label: "Review", icon: View },
  { route: "send", label: "Send", icon: ArrowUpRight },
  { route: "queue", label: "Queue", icon: Layers },
  { route: "history", label: "History", icon: Bot },
  { route: "search", label: "Search", icon: FileSearch },
  { route: "stack", label: "Stack", icon: Sphere },
];

const SETTINGS: NavItem = {
  route: "settings",
  label: "Settings",
  icon: ShieldStrong,
};

export function Sidebar() {
  const { route, setRoute } = useUi();

  return (
    <aside
      data-titlebar="drag"
      className="relative flex w-[228px] shrink-0 flex-col border-r border-white/[0.06] bg-[#0a0a0c]/50 backdrop-blur-2xl backdrop-saturate-150"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"
      />

      {/* Spacer for the macOS traffic-light cluster. */}
      <div className="h-9" aria-hidden />

      {/* Brand — click returns to the welcome / setup screen. */}
      <div data-titlebar="nodrag" className="px-3 pb-3 pt-2">
        <button
          type="button"
          onClick={() => setRoute("setup")}
          aria-label="Argus — back to welcome"
          className="group flex w-full items-center gap-2.5 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-white/[0.03]"
        >
          <img
            src="/logo-mark.png"
            alt=""
            width={18}
            height={18}
            className="shrink-0"
            draggable={false}
          />
          <span
            className="text-[13px] font-light uppercase tracking-[0.22em] text-white/85 group-hover:text-white"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Argus
          </span>
        </button>
      </div>

      <div aria-hidden className="mx-3 my-1 h-px bg-white/[0.05]" />

      <nav data-titlebar="nodrag" className="flex flex-col gap-0.5 px-2 py-2">
        {ITEMS.map((item) => (
          <NavRow
            key={item.route}
            item={item}
            active={route === item.route}
            onSelect={setRoute}
          />
        ))}
      </nav>

      <div data-titlebar="nodrag" className="mt-auto flex flex-col gap-1 px-2 pb-3">
        <NavRow item={SETTINGS} active={route === SETTINGS.route} onSelect={setRoute} />
        <WalletPill />
      </div>
    </aside>
  );
}

function NavRow({
  item,
  active,
  onSelect,
}: {
  item: NavItem;
  active: boolean;
  onSelect: (r: Route) => void;
}) {
  const Icon = item.icon;
  const shortcut = SHORTCUTS[item.route].label;
  return (
    <button
      type="button"
      onClick={() => onSelect(item.route)}
      className={cn(
        "group flex items-center gap-3 rounded-md px-2.5 py-2 text-left text-[13.5px] font-light transition-colors",
        active
          ? "bg-white/[0.06] text-white"
          : "text-white/55 hover:bg-white/[0.03] hover:text-white/85",
      )}
    >
      <Icon size={16} className={active ? "text-white" : "text-white/65"} />
      <span className="flex-1">{item.label}</span>
      <span
        className={cn(
          "font-mono text-[10.5px] tabular-nums tracking-[0.18em]",
          active ? "text-white/55" : "text-white/30 group-hover:text-white/45",
        )}
      >
        {shortcut}
      </span>
    </button>
  );
}

/**
 * Source of truth: `wallet.state` over IPC. Three visual states map to the
 * three lifecycle states from `shared/types/wallet.ts`:
 *
 *   - uninitialised  → neutral grey, "Not initialised"
 *   - locked         → neutral grey, "Locked · 7m4Q…aB9P"
 *   - unlocked       → emerald,      "Active · 7m4Q…aB9P"
 */
function WalletPill() {
  const { data } = useWallet();
  const route = useUi((s) => s.route);
  const setRoute = useUi((s) => s.setRoute);
  const state = data?.state ?? "uninitialised";
  const connected = state === "unlocked";
  const address = data?.address ?? null;
  const balance = useWalletBalance(connected);
  const label =
    state === "unlocked" ? "Active" : state === "locked" ? "Locked" : "Not initialised";
  const subtitle = address && state !== "uninitialised" ? short(address) : null;
  const target: Route = state === "unlocked" ? "settings" : "welcome";
  const active = route === target;

  return (
    <button
      type="button"
      onClick={() => setRoute(target)}
      aria-label={
        state === "unlocked"
          ? `Open wallet settings for ${subtitle ?? "active wallet"}`
          : "Open wallet setup"
      }
      className={cn(
        "group flex w-full items-center gap-2.5 rounded-md border px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/30",
        connected
          ? "border-emerald-400/25 bg-emerald-500/[0.06] hover:border-emerald-300/40 hover:bg-emerald-500/[0.09]"
          : "border-white/[0.06] bg-white/[0.02] hover:border-white/12 hover:bg-white/[0.04]",
        active && (connected ? "border-emerald-300/45" : "border-white/15 bg-white/[0.04]"),
      )}
    >
      <div
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-md border",
          connected
            ? "border-emerald-400/30 bg-emerald-500/[0.08]"
            : "border-white/[0.07] bg-white/[0.04]",
        )}
      >
        <Wallet size={14} className={connected ? "text-emerald-300" : "text-white/70"} />
      </div>
      <div className="flex min-w-0 flex-col leading-tight">
        <span className="flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.18em] text-white/45">
          {label}
          {connected && balance.data && (
            <span className="rounded-sm border border-white/[0.07] px-1 py-px text-[8.5px] tracking-[0.16em] text-white/55">
              {balance.data.cluster}
            </span>
          )}
        </span>
        <span
          className={cn(
            "truncate text-[12px] font-light",
            connected
              ? "text-emerald-200 group-hover:text-emerald-100"
              : "text-white/55 group-hover:text-white/75",
          )}
        >
          {connected && balance.data
            ? `${formatSol(balance.data.sol)} SOL · ${subtitle}`
            : (subtitle ?? (state === "uninitialised" ? "Set up wallet" : "—"))}
        </span>
      </div>
    </button>
  );
}

function short(address: string): string {
  if (address.length <= 9) return address;
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

/** Sub-1 SOL displays in 4 decimals; ≥1 SOL displays in 2. Trailing zeros
 *  are stripped to keep the pill terse. */
function formatSol(sol: number): string {
  if (sol === 0) return "0";
  if (sol < 1) return sol.toFixed(4).replace(/\.?0+$/, "");
  return sol.toFixed(2).replace(/\.?0+$/, "");
}
