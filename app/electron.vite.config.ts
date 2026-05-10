import { resolve } from "node:path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const aliases = {
  "@/shared": resolve(__dirname, "src/shared"),
  "@/main": resolve(__dirname, "src/main"),
  "@/preload": resolve(__dirname, "src/preload"),
  "@/renderer": resolve(__dirname, "src/renderer"),
};

export default defineConfig({
  main: {
    // WDK ships ESM-only and pulls in `sodium-universal` via Bare's runtime.
    // Bundling it inline trips the Bare addon loader. Solution: keep WDK
    // (and its peers) external, then use dynamic `import()` from the CJS
    // main bundle — Node's interop handles ESM dynamically at runtime.
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: aliases },
    build: {
      lib: { entry: resolve(__dirname, "src/main/index.ts") },
      rollupOptions: {
        external: ["better-sqlite3", "electron-log", "electron-updater"],
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: aliases },
    build: {
      lib: { entry: resolve(__dirname, "src/preload/index.ts") },
    },
  },
  renderer: {
    root: resolve(__dirname, "src/renderer"),
    resolve: { alias: aliases },
    plugins: [react(), tailwindcss()],
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, "src/renderer/index.html") },
      },
    },
    server: {
      port: 5173,
    },
  },
});
