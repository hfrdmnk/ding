import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip";
import type { ReactElement, ReactNode } from "react";

type TooltipProps = {
  /** The element to hover, e.g. an icon. It renders as given, not as a button. */
  children: ReactElement;
  content: ReactNode;
};

/** A short label shown on hover. Touch devices never see it, so it can't be the only place information lives. */
export function Tooltip({ children, content }: TooltipProps) {
  return (
    <BaseTooltip.Root>
      <BaseTooltip.Trigger delay={200} render={children} />
      <BaseTooltip.Portal>
        <BaseTooltip.Positioner sideOffset={8}>
          <BaseTooltip.Popup className="origin-(--transform-origin) rounded-lg bg-primary px-2 py-1 text-xs text-bg tabular-nums transition-[opacity,scale] duration-125 ease-out data-ending-style:scale-[0.97] data-ending-style:opacity-0 data-instant:duration-0 data-starting-style:scale-[0.97] data-starting-style:opacity-0">
            {content}
          </BaseTooltip.Popup>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  );
}
