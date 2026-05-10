import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./app";
import "./design/globals.css";

// Per ADR-0002: TanStack Query for IPC reads. One client.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Errors over IPC are deterministic; retrying noisy.
      retry: false,
      staleTime: 30_000,
    },
  },
});

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Missing #root in index.html");

createRoot(rootEl).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
