import { useHotkeys } from "react-hotkeys-hook";
import { useUi, type Route } from "@/renderer/stores/ui";

/**
 * Single source for the app's global keyboard shortcuts. Mirrors the labels
 * shown in the sidebar one-for-one. Add a row in the sidebar, add a binding
 * here, and update SHORTCUTS so the displayed label can't drift from the
 * actual key registered. (DESIGN-PRINCIPLES §accessibility — keyboard-first.)
 */
export const SHORTCUTS: Record<Route, { keys: string; label: string }> = {
  welcome: { keys: "meta+9", label: "⌘ 9" },
  review: { keys: "meta+n", label: "⌘ N" },
  send: { keys: "meta+s", label: "⌘ S" },
  queue: { keys: "meta+1", label: "⌘ 1" },
  history: { keys: "meta+2", label: "⌘ 2" },
  search: { keys: "meta+k", label: "⌘ K" },
  stack: { keys: "meta+3", label: "⌘ 3" },
  settings: { keys: "meta+comma", label: "⌘ ," },
  setup: { keys: "meta+0", label: "⌘ 0" },
};

const opts = { preventDefault: true, enableOnFormTags: false } as const;

export function useShortcuts(): void {
  const setRoute = useUi((s) => s.setRoute);

  useHotkeys(SHORTCUTS.welcome.keys, () => setRoute("welcome"), opts);
  useHotkeys(SHORTCUTS.review.keys, () => setRoute("review"), opts);
  useHotkeys(SHORTCUTS.send.keys, () => setRoute("send"), opts);
  useHotkeys(SHORTCUTS.queue.keys, () => setRoute("queue"), opts);
  useHotkeys(SHORTCUTS.history.keys, () => setRoute("history"), opts);
  useHotkeys(SHORTCUTS.search.keys, () => setRoute("search"), opts);
  useHotkeys(SHORTCUTS.stack.keys, () => setRoute("stack"), opts);
  useHotkeys(SHORTCUTS.settings.keys, () => setRoute("settings"), opts);
  useHotkeys(SHORTCUTS.setup.keys, () => setRoute("setup"), opts);
}
