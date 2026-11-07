// Drawn in a 20×20 box, like the Bluesky composer's counter: a thin track with
// an arc that fills toward the limit, or a pie inside a thick ring.
const R = 8.75;
const ARC = 2 * Math.PI * R;
// A circle of radius r drawn with stroke width 2r is a pie of radius 2r.
const PIE_R = 3.75;
const PIE = 2 * Math.PI * PIE_R;

export function Ring({
  color,
  progress,
  pie = false,
  spin = false,
}: {
  /** Any CSS color, e.g. "var(--blue)". */
  color: string;
  /** Share of the arc (or pie) that is filled, 0–1. */
  progress: number;
  /** A thick ring with a filling pie inside, for overshoot and finished states. */
  pie?: boolean;
  spin?: boolean;
}) {
  const p = Math.min(1, Math.max(0, progress));
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden
      className={`size-5 shrink-0 -rotate-90 ${spin ? "motion-safe:animate-spin" : ""}`}
    >
      {pie ? (
        <>
          <circle
            cx="10"
            cy="10"
            r={R}
            fill="none"
            strokeWidth="2.5"
            style={{ stroke: color }}
          />
          {p > 0 && (
            <circle
              cx="10"
              cy="10"
              r={PIE_R}
              fill="none"
              strokeWidth={2 * PIE_R}
              strokeDasharray={PIE}
              strokeDashoffset={PIE * (1 - p)}
              style={{ stroke: color }}
            />
          )}
        </>
      ) : (
        <>
          <circle
            cx="10"
            cy="10"
            r={R}
            fill="none"
            strokeWidth="1"
            style={{
              stroke: "color-mix(in oklab, var(--secondary) 35%, var(--bg))",
            }}
          />
          {p > 0 && (
            <circle
              cx="10"
              cy="10"
              r={R}
              fill="none"
              strokeWidth="2.5"
              strokeDasharray={ARC}
              strokeDashoffset={ARC * (1 - p)}
              style={{ stroke: color }}
              className="motion-safe:transition-[stroke-dashoffset] motion-safe:duration-150"
            />
          )}
        </>
      )}
    </svg>
  );
}
