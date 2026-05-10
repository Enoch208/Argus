import { useEffect } from "react";
import { AppShell } from "@/renderer/components/shell/app-shell";
import { useUi } from "@/renderer/stores/ui";
import { useWallet } from "@/renderer/hooks/use-wallet";
import HistoryRoute from "@/renderer/routes/history";
import QueueRoute from "@/renderer/routes/queue";
import ReviewRoute from "@/renderer/routes/review";
import SearchRoute from "@/renderer/routes/search";
import SendRoute from "@/renderer/routes/send";
import SettingsRoute from "@/renderer/routes/settings";
import SetupRoute from "@/renderer/routes/setup";
import StackRoute from "@/renderer/routes/stack";
import WelcomeRoute from "@/renderer/routes/welcome";

/**
 * Pure switch over the active route. We don't ship a router library — there
 * is one window, seven views, no URLs.
 *
 * Route-gating rule: an `uninitialised` or `locked` wallet preempts every
 * other route — clicking the sidebar elsewhere is a no-op until the user
 * passes through the Welcome wizard. (DESIGN-PRINCIPLES §accessibility +
 * SECURITY.md: nothing else is meaningful without a wallet.)
 */
export function App() {
  const route = useUi((s) => s.route);
  const setRoute = useUi((s) => s.setRoute);
  const wallet = useWallet();

  // First successful state read drives the gate. Once gated, the user moves
  // forward via the wizard's own setRoute calls.
  useEffect(() => {
    if (!wallet.data) return;
    if (wallet.data.state !== "unlocked" && route !== "welcome") {
      setRoute("welcome");
    }
  }, [wallet.data, route, setRoute]);

  return <AppShell>{renderRoute(route)}</AppShell>;
}

function renderRoute(route: ReturnType<typeof useUi.getState>["route"]) {
  switch (route) {
    case "welcome":
      return <WelcomeRoute />;
    case "setup":
      return <SetupRoute />;
    case "review":
      return <ReviewRoute />;
    case "send":
      return <SendRoute />;
    case "queue":
      return <QueueRoute />;
    case "history":
      return <HistoryRoute />;
    case "search":
      return <SearchRoute />;
    case "stack":
      return <StackRoute />;
    case "settings":
      return <SettingsRoute />;
    default: {
      const _exhaustive: never = route;
      return _exhaustive;
    }
  }
}
