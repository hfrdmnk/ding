import type { ComponentProps } from "react";

type TextFieldProps = ComponentProps<"input"> & { label: string };

export function TextField({ label, className = "", ...props }: TextFieldProps) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-sm font-medium text-secondary">{label}</span>
      {/* text-base keeps iOS from zooming in on focus. */}
      <input
        className="h-11 rounded-lg bg-[color-mix(in_oklab,var(--secondary)_10%,var(--bg))] px-3 text-base text-primary placeholder:text-[color-mix(in_oklab,var(--secondary)_70%,var(--bg))]"
        {...props}
      />
    </label>
  );
}
