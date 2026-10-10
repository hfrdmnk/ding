import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { VitePWA, type ManifestOptions } from "vite-plugin-pwa";

// Hex mirrors of the --bg tokens in src/styles/app.css; manifests can't read CSS.
const LIGHT_BG = "#ffffff";

// Fields every manifest shares. To make a single tool installable on its own
// (e.g. /timer), spread this into a second manifest with its own id, name,
// start_url and scope, emit it as an extra .webmanifest (from public/ or a
// small emit plugin), and have that tool's route point <link rel="manifest">
// at it while mounted. The service worker below already covers every route.
const baseManifest = {
  display: "standalone",
  theme_color: LIGHT_BG,
  background_color: LIGHT_BG,
  icons: [
    { src: "pwa-64x64.png", sizes: "64x64", type: "image/png" },
    { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
    { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
    {
      src: "maskable-icon-512x512.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "maskable",
    },
  ],
} satisfies Partial<ManifestOptions>;

// vite-plugin-pwa normally writes the service worker as the client bundle
// closes, which under Start doesn't happen and would be before the pages are
// prerendered anyway. Generate it once they exist so they're precached. Must
// come after tanstackStart() so its buildApp hook runs last.
const pwaAfterPrerender = (pwa: Plugin[]): Plugin => ({
  name: "ding:pwa-after-prerender",
  apply: "build",
  enforce: "post",
  buildApp: {
    order: "post",
    async handler() {
      const api = pwa.find((p) => p.name === "vite-plugin-pwa")?.api;
      await api.generateSW();
    },
  },
});

const pwa = VitePWA({
  // Start's client build lands here; the default would also sweep up dist/server.
  outDir: "dist/client",
  // A new version waits until every Ding tab is closed instead of taking over
  // (and reloading) a page that may be running a timer. There's no update prompt.
  registerType: "prompt",
  // There's no index.html to inject into; src/routes/__root.tsx registers it.
  injectRegister: false,
  includeAssets: ["favicon.ico", "icon.svg", "apple-touch-icon-180x180.png"],
  manifest: {
    ...baseManifest,
    id: "/",
    name: "Ding",
    short_name: "Ding",
    description: "Simple & useful no nonsense tools.",
    start_url: "/",
    scope: "/",
  },
  workbox: {
    globPatterns: ["**/*.{js,css,html,svg,png,ico,webmanifest}"],
    // Every page is precached as its own HTML (/timer -> timer.html). A
    // fallback would answer other navigations (/robots.txt, typos) with the
    // prerendered home page, which then fails to hydrate at that URL.
    navigateFallback: null,
  },
});

export default defineConfig({
  plugins: [
    // Every route is prerendered to static HTML at build time; there is no server at runtime.
    tanstackStart({
      // timer.html rather than timer/index.html, so the service worker's clean
      // URL matching serves /timer offline.
      prerender: { enabled: true, crawlLinks: true, autoSubfolderIndex: false },
      sitemap: { enabled: true, host: "https://ding.dominikhofer.me" },
    }),
    react(),
    tailwindcss(),
    pwa,
    pwaAfterPrerender(pwa),
  ],
});
