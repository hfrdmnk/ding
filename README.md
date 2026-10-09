# Ding

Simple & useful no nonsense tools. Free, local, offline. No accounts, no ads.

A static React SPA (Vite, TanStack Router, Tailwind CSS v4, Base UI) that installs as a PWA. Conventions for contributors and coding agents live in [AGENTS.md](AGENTS.md).

## Setup

Requires Node 24+.

```sh
npm install
npm run dev
```

## Scripts

| Script              | What it does                                 |
| ------------------- | -------------------------------------------- |
| `npm run dev`       | Dev server                                   |
| `npm run build`     | Typecheck, then build a fully static `dist/` |
| `npm run preview`   | Serve `dist/` with the service worker active |
| `npm run typecheck` | `tsc -b`                                     |
| `npm run lint`      | ESLint                                       |
| `npm run format`    | Prettier (`format:check` to verify only)     |

Placeholder icons in `public/` were generated from `public/icon.svg` with `npx @vite-pwa/assets-generator --preset minimal-2023 public/icon.svg`.

## Open decisions

- **Precise sound scheduling.** `@web-kits/audio` 0.2.0 has no public "start at AudioContext time" option. `playAt()` in `src/lib/audio.ts` works around it by offsetting each layer's `delay` from `currentTime`, which is sample-accurate but creates the voice up front (stop the returned handle to cancel). An upstream `when`/`baseTime` play option would remove the workaround; the internal `render()` already takes one.
- **Audio while backgrounded / on iOS.** Scheduled sounds only play while the AudioContext runs. iOS suspends it in the background and Web Audio follows the silent switch unless `navigator.audioSession.type = "playback"` is set. Decide this with the timer.
- **React audio hooks.** Not used on purpose: `useSound` and friends from `@web-kits/audio/react` stay silent under `prefers-reduced-motion`.
- **TypeScript 6.0, not 7.** `typescript-eslint` 8.71 supports TypeScript `<6.1`. Move to TS 7 once it does.
- **Dark theme color in the manifest.** The manifest has one `theme_color` (light). Dark is handled by `<meta name="theme-color" media=…>` in `index.html`; browsers don't yet support per-scheme manifest colors.
- **Per-tool install.** One manifest for now. `vite.config.ts` explains how to add per-tool manifests.
- **AT Protocol sync.** Not built. Each store declares `sync` so the sync layer can pick what to send.
