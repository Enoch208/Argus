import { create } from "zustand";

export type Route =
  | "welcome"
  | "setup"
  | "review"
  | "queue"
  | "history"
  | "search"
  | "stack"
  | "settings";

interface UiState {
  route: Route;
  sidebarOpen: boolean;
  setRoute: (route: Route) => void;
  toggleSidebar: () => void;
}

export const useUi = create<UiState>((set) => ({
  // The Welcome / wallet route is the entry point; AppShell promotes the user
  // to `setup` (model download) once a wallet exists.
  route: "welcome",
  sidebarOpen: true,
  setRoute: (route) => set({ route }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
}));
