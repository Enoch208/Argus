# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

The actual app lives in [landing_page/](landing_page/) — a Next.js 16 + React 19 + Tailwind v4 project. The repo root only contains that subdirectory (plus an untracked `f.html` design reference). Run all commands from `landing_page/`.

## Critical: Next.js 16 is not what you remember

Per [landing_page/AGENTS.md](landing_page/AGENTS.md): this is Next.js **16.2.6** with React **19.2.4** and Tailwind **v4**. APIs, conventions, and file structure differ from training data and most online tutorials. **Before writing any Next.js code, read the relevant guide in [landing_page/node_modules/next/dist/docs/](landing_page/node_modules/next/dist/docs/)** (organized as `01-app/`, `02-pages/`, `03-architecture/`, `04-community/`). Heed deprecation notices in your edits and in the dev server output.

The same applies to Tailwind v4 (config-less, CSS-first via `@tailwindcss/postcss`) — don't reach for `tailwind.config.js` patterns from v3.

## Commands

From [landing_page/](landing_page/):

- `npm run dev` — start the dev server on http://localhost:3000
- `npm run build` — production build
- `npm run start` — serve the production build
- `npm run lint` — run ESLint (flat config in [eslint.config.mjs](landing_page/eslint.config.mjs), extends `next/core-web-vitals` and `next/typescript`)

There is no test runner configured.

## Architecture notes

- App Router only — pages live under [landing_page/app/](landing_page/app/) ([layout.tsx](landing_page/app/layout.tsx) is the root layout, [page.tsx](landing_page/app/page.tsx) is the index route).
- TypeScript path alias `@/*` resolves to the `landing_page/` root (see [tsconfig.json](landing_page/tsconfig.json)).
- Fonts are loaded via `next/font/google` (Geist / Geist Mono) in the root layout and exposed as CSS variables (`--font-geist-sans`, `--font-geist-mono`).
- Global styles in [app/globals.css](landing_page/app/globals.css); component styling is Tailwind utility classes.
