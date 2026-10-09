import { useEffect, useRef } from "react";

type DialProps = {
  /**
   * Share of the current phase still remaining, 0–1. Pass a function to have
   * the dial read it every animation frame without re-rendering React.
   */
  fraction: number | (() => number);
  /** Any CSS color, e.g. "var(--orange)". */
  color: string;
  className?: string;
};

const SIZE = 200;
const C = SIZE / 2;
const WEDGE_R = 82;
const TICK_OUTER = 96;

// Wedge from 12 o'clock sweeping clockwise; it shrinks back toward 12 as the fraction drops.
function wedgePath(fraction: number) {
  const f = Math.min(1, Math.max(0, fraction));
  if (f === 0) return "";
  if (f === 1)
    return `M ${C} ${C - WEDGE_R} A ${WEDGE_R} ${WEDGE_R} 0 1 1 ${C} ${C + WEDGE_R} A ${WEDGE_R} ${WEDGE_R} 0 1 1 ${C} ${C - WEDGE_R} Z`;
  const angle = f * 2 * Math.PI;
  const x = C + WEDGE_R * Math.sin(angle);
  const y = C - WEDGE_R * Math.cos(angle);
  const largeArc = f > 0.5 ? 1 : 0;
  return `M ${C} ${C} L ${C} ${C - WEDGE_R} A ${WEDGE_R} ${WEDGE_R} 0 ${largeArc} 1 ${x} ${y} Z`;
}

const ticks = Array.from({ length: 60 }, (_, i) => {
  const major = i % 5 === 0;
  const angle = (i / 60) * 2 * Math.PI;
  const inner = TICK_OUTER - (major ? 9 : 4);
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);
  return {
    major,
    x1: C + inner * sin,
    y1: C - inner * cos,
    x2: C + TICK_OUTER * sin,
    y2: C - TICK_OUTER * cos,
  };
});

export function Dial({ fraction, color, className = "" }: DialProps) {
  const wedgeRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    if (typeof fraction !== "function") return;
    let frame = requestAnimationFrame(function draw() {
      wedgeRef.current?.setAttribute("d", wedgePath(fraction()));
      frame = requestAnimationFrame(draw);
    });
    return () => cancelAnimationFrame(frame);
  }, [fraction]);

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className={`block aspect-square w-full ${className}`}
      aria-hidden
    >
      <g stroke="var(--secondary)" strokeLinecap="round">
        {ticks.map(({ major, ...line }, i) => (
          <line key={i} {...line} strokeWidth={major ? 1.5 : 0.75} />
        ))}
      </g>
      <path
        ref={wedgeRef}
        d={typeof fraction === "number" ? wedgePath(fraction) : ""}
        fill={color}
      />
      <circle cx={C} cy={C} r={6} fill="var(--primary)" />
    </svg>
  );
}
