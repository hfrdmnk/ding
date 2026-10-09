import { createFileRoute, Link, type LinkProps } from "@tanstack/react-router";
import { Signature } from "../ui/Signature";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Ding" }] }),
  component: Index,
});

const tools: { name: string; description: string; to?: LinkProps["to"] }[] = [
  { name: "Interval timer", description: "Work, rest, repeat." },
  { name: "Box breathing", description: "In, hold, out, hold." },
  { name: "Today", description: "A to-do list that forgets at midnight." },
];

function Index() {
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom))] w-full max-w-md flex-col px-6 pt-10 pb-10">
      <main className="flex flex-1 flex-col justify-center">
        <header className="text-center">
          <h1 className="text-xl font-medium">Ding</h1>
          <p className="mt-2 text-secondary">
            Simple & useful no nonsense tools.
          </p>
        </header>

        <ul className="mt-14 divide-y divide-[color-mix(in_oklab,var(--secondary)_25%,var(--bg))] border-y border-[color-mix(in_oklab,var(--secondary)_25%,var(--bg))]">
          {tools.map((tool) => (
            <li key={tool.name}>
              {tool.to ? (
                <Link to={tool.to} className="block py-4">
                  <span className="font-medium">{tool.name}</span>
                  <span className="mt-0.5 block text-sm text-secondary">
                    {tool.description}
                  </span>
                </Link>
              ) : (
                <div className="py-4 text-secondary">
                  <span className="flex items-baseline justify-between gap-4">
                    <span className="font-medium">{tool.name}</span>
                    <span className="text-xs">Soon</span>
                  </span>
                  <span className="mt-0.5 block text-sm">
                    {tool.description}
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      </main>

      <footer className="pt-20 text-center text-secondary">
        <a
          href="https://dominikhofer.me"
          className="mx-auto block w-fit transition-colors hover:text-primary"
        >
          <Signature className="h-10" />
        </a>
        <p className="mt-4 text-sm">
          Free, local, offline. No accounts, no ads.
        </p>
      </footer>
    </div>
  );
}
