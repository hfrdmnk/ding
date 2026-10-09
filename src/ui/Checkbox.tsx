import { Checkbox as BaseCheckbox } from "@base-ui/react/checkbox";
import type { ReactNode } from "react";

type CheckboxProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  children: ReactNode;
};

export function Checkbox({
  checked,
  onCheckedChange,
  children,
}: CheckboxProps) {
  return (
    <label className="group flex min-h-11 cursor-pointer items-center gap-3 select-none">
      <BaseCheckbox.Root
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="grid size-5 shrink-0 place-items-center rounded-md border-[1.5px] border-[color-mix(in_oklab,var(--secondary)_35%,var(--bg))] transition-colors duration-150 group-hover:border-[color-mix(in_oklab,var(--secondary)_60%,var(--bg))]"
      >
        <BaseCheckbox.Indicator className="size-3 rounded-[2px] bg-[color-mix(in_oklab,var(--secondary)_35%,var(--bg))] transition-colors duration-150 group-hover:bg-[color-mix(in_oklab,var(--secondary)_60%,var(--bg))] data-unchecked:hidden" />
      </BaseCheckbox.Root>
      {children}
    </label>
  );
}
