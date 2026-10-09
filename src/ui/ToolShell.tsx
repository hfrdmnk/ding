import { Link } from "@tanstack/react-router";
import { NavArrowLeft, Settings } from "iconoir-react";
import type { CSSProperties, ReactNode } from "react";
import { Dialog } from "./Dialog";

type ToolShellProps = {
  title: string;
  accent?: "orange" | "violet";
  /** Contents of the settings dialog. Omit to hide the settings button. */
  settings?: ReactNode;
  children: ReactNode;
};

const iconButton =
  "grid size-11 place-items-center rounded-full text-secondary hover:text-primary";

export function ToolShell({
  title,
  accent,
  settings,
  children,
}: ToolShellProps) {
  const style = accent
    ? ({ "--accent": `var(--${accent})` } as CSSProperties)
    : undefined;

  return (
    <div
      style={style}
      className="mx-auto flex min-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom))] w-full max-w-md flex-col px-4"
    >
      <header className="grid h-16 grid-cols-[2.75rem_1fr_2.75rem] items-center">
        <Link to="/" aria-label="All tools" className={`-ml-2.5 ${iconButton}`}>
          <NavArrowLeft width={22} height={22} />
        </Link>
        <h1 className="text-center text-base font-semibold">{title}</h1>
        {settings && (
          <Dialog
            title="Settings"
            trigger={
              <button
                type="button"
                aria-label="Settings"
                className={`-mr-2.5 justify-self-end ${iconButton}`}
              >
                <Settings width={20} height={20} />
              </button>
            }
          >
            {settings}
          </Dialog>
        )}
      </header>
      <main className="flex flex-1 flex-col pb-6">{children}</main>
    </div>
  );
}
