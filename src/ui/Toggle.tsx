import type { ReactNode } from "react";

type ToggleProps = {
  /** Accessible name; the button itself shows only `children` (an icon). */
  label: string;
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
  children: ReactNode;
};

/** Square icon toggle, sized to sit next to a Slider. */
export function Toggle({
  label,
  pressed,
  onPressedChange,
  children,
}: ToggleProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      onClick={() => onPressedChange(!pressed)}
      className="grid size-11 shrink-0 place-items-center rounded-lg bg-[color-mix(in_oklab,var(--secondary)_10%,var(--bg))] text-secondary transition-[color,background-color,scale] duration-150 ease-out select-none not-aria-pressed:hover:text-primary active:scale-[0.97] aria-pressed:bg-primary aria-pressed:text-bg"
    >
      {children}
    </button>
  );
}
