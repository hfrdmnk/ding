import { Checkbox as BaseCheckbox } from "@base-ui/react/checkbox";
import { Check } from "iconoir-react";
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
    <label className="flex min-h-11 cursor-pointer items-center gap-3 select-none">
      <BaseCheckbox.Root
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="grid size-5 shrink-0 place-items-center rounded-md border-[1.5px] border-secondary text-bg transition-colors duration-100 data-checked:border-primary data-checked:bg-primary"
      >
        <BaseCheckbox.Indicator className="data-unchecked:hidden">
          <Check width={14} height={14} strokeWidth={2.5} />
        </BaseCheckbox.Indicator>
      </BaseCheckbox.Root>
      {children}
    </label>
  );
}
