import { useEffect, useRef } from "react";

type DialProps = {
  /**
   * Filled share of the circle, 0–1. Pass a function to have the dial read
   * it every animation frame without re-rendering React.
   */
  fraction: number | (() => number);
  /** Any CSS color, e.g. "var(--orange)". */
  color: string;
  className?: string;
};

const R = 100;
const CORNER = 8;

// Point at `angle` (radians clockwise from 12 o'clock) and `distance` from the centre.
const at = (angle: number, distance: number) =>
  `${R + distance * Math.sin(angle)} ${R - distance * Math.cos(angle)}`;

// How far the rounded tip may sit back from the centre, which caps the corner
// radius while the wedge is narrow. Corners reach CORNER at ~22% of the sweep.
const TIP_GAP = 4;

// Wedge from 12 o'clock sweeping clockwise, with rounded corners and its
// straight edges exactly on the hand lines. Past half the circle the centre
// corner is concave and stays sharp.
function wedgePath(fraction: number) {
  const f = Math.min(1, Math.max(0, fraction));
  if (f === 0) return "";
  if (f === 1)
    return `M ${R} 0 A ${R} ${R} 0 1 1 ${R} ${2 * R} A ${R} ${R} 0 1 1 ${R} 0 Z`;
  const sweep = f * 2 * Math.PI;
  const s = Math.sin(Math.min(sweep, Math.PI) / 2);
  const c = s === 1 ? CORNER : Math.min(CORNER, (TIP_GAP * s) / (1 - s));
  // Outer fillets: tangent to the rim at `rim` radians in from each edge, and to each edge at `edge` from the centre.
  const rim = Math.asin(c / (R - c));
  const edge = Math.sqrt((R - c) ** 2 - c ** 2);
  // Centre fillet: tangent to both edges at `hub` from the centre.
  const hub = sweep < Math.PI ? c / Math.tan(sweep / 2) : 0;
  const largeArc = sweep - 2 * rim > Math.PI ? 1 : 0;
  return [
    `M ${at(0, hub)}`,
    `L ${at(0, edge)}`,
    `A ${c} ${c} 0 0 1 ${at(rim, R)}`,
    `A ${R} ${R} 0 ${largeArc} 1 ${at(sweep - rim, R)}`,
    `A ${c} ${c} 0 0 1 ${at(sweep, edge)}`,
    `L ${at(sweep, hub)}`,
    hub > 0 ? `A ${c} ${c} 0 0 1 ${at(0, hub)}` : "",
    "Z",
  ].join(" ");
}

export function Dial({ fraction, color, className = "" }: DialProps) {
  const wedgeRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    const el = wedgeRef.current;
    if (!el) return;
    if (typeof fraction === "number")
      return void el.setAttribute("d", wedgePath(fraction));
    let frame = requestAnimationFrame(function tick() {
      el.setAttribute("d", wedgePath(fraction()));
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [fraction]);

  return (
    <svg
      viewBox={`0 0 ${2 * R} ${2 * R}`}
      className={`block aspect-square w-full ${className}`}
      aria-hidden
    >
      <path ref={wedgeRef} style={{ fill: color }} />
    </svg>
  );
}
