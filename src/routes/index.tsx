import { createFileRoute, Link, type LinkProps } from "@tanstack/react-router";
import type { ComponentType } from "react";
import { BreatheIcon } from "../tools/breathe/BreatheIcon";
import { TimerIcon } from "../tools/timer/TimerIcon";
import { TodayIcon } from "../tools/today/TodayIcon";
import { Logo } from "../ui/Logo";
import { Signature } from "../ui/Signature";
import { WavyDivider } from "../ui/WavyDivider";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Ding" }] }),
  component: Index,
});

const tools: {
  name: string;
  description: string;
  Icon: ComponentType<{ className?: string }>;
  to?: LinkProps["to"];
}[] = [
  {
    name: "Interval timer",
    description: "Work, rest, repeat.",
    Icon: TimerIcon,
  },
  {
    name: "Box breathing",
    description: "In, hold, out, hold.",
    Icon: BreatheIcon,
  },
  {
    name: "Today",
    description: "A to-do list that forgets at midnight.",
    Icon: TodayIcon,
  },
];

function Index() {
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom))] w-full max-w-md flex-col px-6 pt-10 pb-10">
      <main className="flex flex-1 flex-col justify-center">
        <header className="text-center">
          <Logo className="mx-auto h-6" />
          <h1 className="mt-6 text-xl font-medium">Ding</h1>
          <p className="mt-2 text-secondary">
            Simple & useful no nonsense tools.
          </p>
        </header>

        <ul className="mt-14">
          {tools.map((tool, i) => (
            <li key={tool.name}>
              {i > 0 && (
                <WavyDivider className="mx-auto w-12 text-[color-mix(in_oklab,var(--secondary)_25%,var(--bg))]" />
              )}
              {tool.to ? (
                <Link
                  to={tool.to}
                  className="group flex items-center gap-4 py-6"
                >
                  <tool.Icon className="size-7 shrink-0 transition-colors group-hover:text-orange" />
                  <span>
                    <span className="font-medium transition-colors group-hover:text-orange">
                      {tool.name}
                    </span>
                    <span className="mt-0.5 block text-sm text-secondary">
                      {tool.description}
                    </span>
                  </span>
                </Link>
              ) : (
                <div className="group flex items-center gap-4 py-6 text-secondary">
                  <tool.Icon className="size-7 shrink-0 text-primary transition-colors group-hover:text-orange" />
                  <span className="flex-1">
                    <span className="flex items-baseline justify-between gap-4">
                      <span className="font-medium text-primary transition-colors group-hover:text-orange">
                        {tool.name}
                      </span>
                      <span className="text-xs">Soon</span>
                    </span>
                    <span className="mt-0.5 block text-sm">
                      {tool.description}
                    </span>
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
