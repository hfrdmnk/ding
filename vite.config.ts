import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
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

export default defineConfig({
  plugins: [
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "favicon.ico",
        "icon.svg",
        "apple-touch-icon-180x180.png",
      ],
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
      },
    }),
  ],
});
