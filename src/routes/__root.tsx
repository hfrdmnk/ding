import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import appCss from "../styles/app.css?url";

// Keep in sync with the sitemap host in vite.config.ts.
const siteUrl = "https://ding.dominikhofer.me";

export const Route = createRootRoute({
  head: ({ matches }) => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
      },
      { name: "color-scheme", content: "light dark" },
      { name: "description", content: "Simple & useful no nonsense tools." },
      { title: "Ding" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", sizes: "48x48" },
      { rel: "icon", href: "/icon.svg", type: "image/svg+xml" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon-180x180.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      // One URL per page for search engines, whether reached as /timer or /timer.html.
      { rel: "canonical", href: siteUrl + (matches.at(-1)?.pathname ?? "/") },
    ],
  }),
  shellComponent: RootDocument,
  component: Root,
});

function Root() {
  useEffect(() => {
    // Loaded lazily so the prerender never evaluates service worker code.
    void import("virtual:pwa-register").then(({ registerSW }) =>
      registerSW({ immediate: true }),
    );
  }, []);
  return <Outlet />;
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        {/* Here rather than in head(): HeadContent keeps only one meta per name. */}
        <meta
          name="theme-color"
          media="(prefers-color-scheme: light)"
          content="#ffffff"
        />
        <meta
          name="theme-color"
          media="(prefers-color-scheme: dark)"
          content="#0a0a0a"
        />
        <script
          defer
          data-domain="ding.dominikhofer.me"
          src="https://analytics.linea.studio/js/script.js"
        />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
