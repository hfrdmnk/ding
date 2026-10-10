import { Link } from "@tanstack/react-router";
import { NavArrowLeft, Settings } from "iconoir-react";
import type { ReactNode } from "react";
import { Dialog } from "./Dialog";
import { Logo } from "./Logo";

type ToolShellProps = {
  title: string;
  /** Contents of the settings dialog. Omit to hide the settings button. */
  settings?: ReactNode;
  children: ReactNode;
};

const iconButton =
  "grid size-11 place-items-center rounded-full text-secondary hover:text-primary";

export function ToolShell({ title, settings, children }: ToolShellProps) {
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom))] w-full max-w-md flex-col px-4">
      <header className="grid h-16 grid-cols-[2.75rem_1fr_2.75rem] items-center">
        <Link to="/" aria-label="All tools" className={`-ml-2.5 ${iconButton}`}>
          <NavArrowLeft width={22} height={22} />
        </Link>
        <div className="flex justify-center">
          <Logo className="h-4 text-secondary" />
          <h1 className="sr-only">{title}</h1>
        </div>
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
