import { useId } from "react";

export function WavyDivider({ className = "" }: { className?: string }) {
  const id = useId();
  return (
    <svg aria-hidden className={`block h-1.5 ${className}`}>
      <defs>
        <pattern id={id} width="12" height="6" patternUnits="userSpaceOnUse">
          {/* Overshoots the tile so strokes join without seams. */}
          <path
            d="M-6 3 Q-3 6 0 3 T6 3 T12 3 T18 3"
            fill="none"
            stroke="currentColor"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}
