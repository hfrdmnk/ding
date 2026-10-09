import type { ComponentProps } from "react";

type ButtonProps = ComponentProps<"button"> & {
  variant?: "primary" | "ghost";
};

const variants = {
  primary: "bg-primary text-bg px-7",
  ghost:
    "px-4 text-primary hover:bg-[color-mix(in_oklab,var(--secondary)_12%,var(--bg))]",
};

export function Button({
  variant = "primary",
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-full text-[15px] font-medium transition-transform duration-100 ease-out select-none active:scale-[0.97] disabled:opacity-40 ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
