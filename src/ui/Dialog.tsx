import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { Xmark } from "iconoir-react";
import type { ReactElement, ReactNode } from "react";

type DialogProps = {
  /** The element that opens the dialog, e.g. a Button. */
  trigger: ReactElement;
  title: string;
  children: ReactNode;
};

export function Dialog({ trigger, title, children }: DialogProps) {
  return (
    <BaseDialog.Root>
      <BaseDialog.Trigger render={trigger} />
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="fixed inset-0 bg-[color-mix(in_oklab,var(--bg)_85%,transparent)] transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <BaseDialog.Popup className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 flex w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 flex-col gap-5 rounded-3xl border border-[color-mix(in_oklab,var(--secondary)_25%,var(--bg))] bg-bg p-5 text-primary transition-[opacity,scale] duration-150 ease-out data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0 sm:top-1/2 sm:bottom-auto sm:-translate-y-1/2">
          <div className="flex items-center justify-between">
            <BaseDialog.Title className="text-base font-semibold">
              {title}
            </BaseDialog.Title>
            <BaseDialog.Close
              aria-label="Close"
              className="-mr-2 grid size-10 place-items-center rounded-full text-secondary hover:text-primary"
            >
              <Xmark width={20} height={20} />
            </BaseDialog.Close>
          </div>
          {children}
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}
