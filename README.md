# Ding

Simple & useful no nonsense tools. Free, local, offline. No accounts, no ads.

A React app (Vite, TanStack Start, Tailwind CSS v4, Base UI) whose routes are prerendered to static HTML at build time, so every page is crawlable and there is no server at runtime. It installs as a PWA. Conventions for contributors and coding agents live in [AGENTS.md](AGENTS.md).

## Setup

Requires Node 24+ and pnpm (pinned via `devEngines` in `package.json`; pnpm fetches the right version itself). npm, yarn and bun are blocked.

```sh
pnpm install
pnpm dev
```

## Scripts

| Script           | What it does                                 |
| ---------------- | -------------------------------------------- |
| `pnpm dev`       | Dev server                                   |
| `pnpm build`     | Typecheck, then prerender into `dist/client` |
| `pnpm preview`   | Serve the build with the service worker on   |
| `pnpm typecheck` | `tsc -b`                                     |
| `pnpm lint`      | ESLint                                       |
| `pnpm format`    | Prettier (`format:check` to verify only)     |

The PNG app icons in `public/` are generated from `public/app-icon.svg` with `pnpm dlx @vite-pwa/assets-generator` (settings in `pwa-assets.config.js`). The tab favicon is the logo's square in `--orange`: `public/icon.svg` is edited by hand, and `favicon.ico` comes from `magick -size 48x48 xc:none -fill '#ff5500' -draw 'roundrectangle 0,0 47,47 6,6' public/favicon.ico`.

## Deployment

Pushes to `main` deploy to [ding.dominikhofer.me](https://ding.dominikhofer.me) via GitHub Actions (`.github/workflows/deploy.yml`), which builds the `Dockerfile`, pushes the image to `ghcr.io/hfrdmnk/ding` and triggers Dokploy to pull it. Inside the image, pnpm builds the site, then Caddy serves `dist/client` on port 80 (see `Caddyfile` for routing and cache headers). Dokploy's Traefik terminates TLS. `sitemap.xml` is generated from the prerendered routes.

## Open decisions

- **Precise sound scheduling.** `@web-kits/audio` 0.2.0 has no public "start at AudioContext time" option. `playAt()` in `src/lib/audio.ts` works around it by offsetting each layer's `delay` from `currentTime`, which is sample-accurate but creates the voice up front (stop the returned handle to cancel). An upstream `when`/`baseTime` play option would remove the workaround; the internal `render()` already takes one.
- **Audio while backgrounded / on iOS.** Scheduled sounds only play while the AudioContext runs. iOS suspends it in the background and Web Audio follows the silent switch unless `navigator.audioSession.type = "playback"` is set. Decide this with the timer.
- **React audio hooks.** Not used on purpose: `useSound` and friends from `@web-kits/audio/react` stay silent under `prefers-reduced-motion`.
- **TypeScript 6.0, not 7.** `typescript-eslint` 8.71 supports TypeScript `<6.1`. Move to TS 7 once it does.
- **Dark theme color in the manifest.** The manifest has one `theme_color` (light). Dark is handled by `<meta name="theme-color" media=…>` in `src/routes/__root.tsx`; browsers don't yet support per-scheme manifest colors.
- **Per-tool install.** One manifest for now. `vite.config.ts` explains how to add per-tool manifests.
- **AT Protocol sync.** Not built. Each store declares `sync` so the sync layer can pick what to send.
- **Release-age exclusion.** pnpm 12 holds back packages younger than its `minimumReleaseAge`. `@base-ui/react@1.9.0` was a day old at setup, so `pnpm-workspace.yaml` lists it (and `@base-ui/utils@0.5.0`) under `minimumReleaseAgeExclude`. Those entries can go once they're past the age limit.
