import {
  type CSSProperties,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { tick } from "../lib/haptics";

/**
 * One section of a nonlinear track: runs from where the previous section
 * ends (or `min`) up to `to` in steps of `step`, across `share` of the width.
 */
export type SliderSegment = { to: number; step: number; share: number };

type SliderProps = {
  label: string;
  value: number;
  onValueChange: (value: number) => void;
  min: number;
  format?: (value: number) => string;
} & (
  | { max: number; step?: number; segments?: never }
  | { segments: SliderSegment[]; max?: never; step?: never }
);

// Adapted from DialKit's slider (MIT, Josh Puckett): https://github.com/joshpuckett/dialkit
const CLICK_THRESHOLD = 3;
const RUBBER_DEAD_ZONE = 32;
const RUBBER_RANGE = 200;
const RUBBER_MAX = 8;
const MARK_PULL = 1 / 32;
// The handle sits this far inside the fill's edge, and never closer than HANDLE_MIN to the track's start.
const HANDLE_INSET = 9;
const HANDLE_MIN = 5;
const HANDLE_WIDTH = 3;
// Label and value sit 12px (px-3) from the track's ends; the handle keeps this gap from them.
const TEXT_INSET = 12;
const DODGE_GAP = 8;

const clamp = (n: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, n));

type Section = SliderSegment & {
  from: number;
  /** Track fractions where the section starts and ends. */
  start: number;
  end: number;
};

function resolveSections(min: number, segments: SliderSegment[]): Section[] {
  const total = segments.reduce((sum, s) => sum + s.share, 0);
  let from = min;
  let start = 0;
  return segments.map((segment) => {
    const end = start + segment.share / total;
    const section = { ...segment, from, start, end };
    from = segment.to;
    start = end;
    return section;
  });
}

const sectionOf = (sections: Section[], value: number) =>
  sections.find((s) => value <= s.to) ?? sections[sections.length - 1];

function fractionOf(sections: Section[], value: number) {
  const s = sectionOf(sections, value);
  const within = s.to === s.from ? 0 : (value - s.from) / (s.to - s.from);
  return clamp(s.start + within * (s.end - s.start), 0, 1);
}

function valueAtFraction(sections: Section[], f: number) {
  const s = sections.find((s) => f <= s.end) ?? sections[sections.length - 1];
  const within = s.end === s.start ? 0 : (f - s.start) / (s.end - s.start);
  return s.from + within * (s.to - s.from);
}

// Accepts what `format` shows for durations ("1:30", "1:30:00") as well as plain numbers.
function parse(text: string): number {
  const time = text.trim().match(/^(?:(\d+):)?(\d+):(\d{1,2})$/);
  if (time)
    return Number(time[1] ?? 0) * 3600 + Number(time[2]) * 60 + Number(time[3]);
  return Number.parseFloat(text);
}

export function Slider({
  label,
  value,
  onValueChange,
  min,
  max: linearMax,
  step = 1,
  segments,
  format = String,
}: SliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const valueRef = useRef<HTMLSpanElement>(null);
  const gesture = useRef<{
    x: number;
    y: number;
    rect: DOMRect;
    onValue: boolean;
    touch: boolean;
    /** Last value committed during the gesture; React's `value` lags behind fast moves. */
    last: number;
  } | null>(null);
  const editOnClick = useRef(false);
  const cancelled = useRef(false);

  const [pressed, setPressed] = useState(false);
  // Raw fraction under the pointer while dragging; the fill follows it, not the stepped value.
  const [dragFraction, setDragFraction] = useState<number | null>(null);
  const [stretch, setStretch] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [instant, setInstant] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const [widths, setWidths] = useState({ track: 0, label: 0, value: 0 });
  const editing = draft !== null;

  useEffect(() => {
    const observer = new ResizeObserver(() =>
      setWidths({
        track: trackRef.current?.offsetWidth ?? 0,
        label: labelRef.current?.offsetWidth ?? 0,
        value: valueRef.current?.offsetWidth ?? 0,
      }),
    );
    for (const el of [trackRef.current, labelRef.current, valueRef.current])
      if (el) observer.observe(el);
    return () => observer.disconnect();
  }, [editing]);

  // A linear slider is a single section spanning the whole track.
  const sections = resolveSections(
    min,
    segments ?? [{ to: linearMax ?? min, step, share: 1 }],
  );
  const max = sections.at(-1)?.to ?? min;
  const steps = Math.round((max - min) / step);
  const dragging = dragFraction !== null;
  const fraction = dragFraction ?? fractionOf(sections, value);
  const active = hovered || pressed || focused;
  const valueAt = (f: number) => valueAtFraction(sections, f);

  const round = (n: number) => {
    const clamped = clamp(n, min, max);
    if (clamped === min || clamped === max) return clamped;
    const s = sectionOf(sections, clamped);
    const snapped = s.from + Math.round((clamped - s.from) / s.step) * s.step;
    return clamp(Number(snapped.toPrecision(14)), s.from, s.to);
  };

  const commit = (next: number, animate: boolean) => {
    setInstant(!animate);
    const rounded = round(next);
    onValueChange(rounded);
    return rounded;
  };

  // A haptic tick for each step a finger moves the value.
  const commitGesture = (next: number, animate: boolean) => {
    const start = gesture.current;
    const rounded = commit(next, animate);
    if (!start || rounded === start.last) return;
    start.last = rounded;
    if (start.touch) tick();
  };

  // Steps can differ on either side of a section boundary, so go one at a time.
  const stepBy = (from: number, count: number) => {
    let next = round(from);
    // An off-grid value that snapping moved in the right direction has already taken its first step.
    const snapped = Math.sign(next - from) === Math.sign(count) ? 1 : 0;
    for (let i = snapped; i < Math.abs(count); i++) {
      const s =
        count > 0
          ? sections.find((s) => s.to > next)
          : sections.findLast((s) => s.from < next);
      if (!s) break;
      next = round(next + Math.sign(count) * s.step);
    }
    return next;
  };

  // Linear tracks mark deciles (or every step when there are few); nonlinear ones mark where sections meet.
  const marks = segments
    ? sections.slice(0, -1).map((s) => s.end)
    : Array.from(
        { length: Math.min(steps, 10) - 1 },
        (_, i) => (i + 1) / Math.min(steps, 10),
      );

  const fractionAt = (clientX: number, rect: DOMRect) =>
    clamp((clientX - rect.left) / rect.width, 0, 1);

  // Clicks land on a nearby mark (or on the nearest step when there are few).
  const snapClick = (f: number) => {
    if (!segments && steps <= 10) return min + Math.round(f * steps) * step;
    const mark = marks.find((m) => Math.abs(f - m) <= MARK_PULL);
    return valueAt(mark ?? f);
  };

  const rubberBand = (clientX: number, rect: DOMRect) => {
    const past =
      clientX < rect.left ? rect.left - clientX : clientX - rect.right;
    const overflow = Math.max(0, past - RUBBER_DEAD_ZONE);
    const amount = RUBBER_MAX * Math.sqrt(Math.min(overflow / RUBBER_RANGE, 1));
    if (clientX < rect.left) return -amount;
    if (clientX > rect.right) return amount;
    return 0;
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (editing || event.button !== 0) return;
    const wrapper = event.currentTarget.parentElement;
    if (!wrapper) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    editOnClick.current = false;
    gesture.current = {
      x: event.clientX,
      y: event.clientY,
      rect: wrapper.getBoundingClientRect(),
      onValue: valueRef.current?.contains(event.target as Node) ?? false,
      touch: event.pointerType === "touch",
      last: value,
    };
    setPressed(true);
  };

  const onPointerMove = (event: PointerEvent) => {
    const start = gesture.current;
    if (!start) return;
    const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y);
    if (!dragging && moved <= CLICK_THRESHOLD) return;
    const f = fractionAt(event.clientX, start.rect);
    setDragFraction(f);
    setStretch(rubberBand(event.clientX, start.rect));
    commitGesture(valueAt(f), false);
  };

  const onPointerUp = (event: PointerEvent) => {
    const start = gesture.current;
    if (!start) return;
    // A press on the value edits it; a drag that starts there still moves the slider.
    if (!dragging && start.onValue) editOnClick.current = true;
    else {
      const f = fractionAt(event.clientX, start.rect);
      commitGesture(dragging ? valueAt(f) : snapClick(f), true);
    }
    endGesture();
  };

  const endGesture = () => {
    gesture.current = null;
    setPressed(false);
    setDragFraction(null);
    setStretch(0);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.target !== event.currentTarget) return;
    if (event.altKey || event.metaKey || event.ctrlKey) return;
    if (event.key === "Enter") {
      event.preventDefault();
      setDraft(format(value));
      return;
    }
    const big = event.shiftKey || event.key.startsWith("Page") ? 10 : 1;
    const next = {
      Home: min,
      End: max,
      ArrowRight: stepBy(value, big),
      ArrowUp: stepBy(value, big),
      PageUp: stepBy(value, big),
      ArrowLeft: stepBy(value, -big),
      ArrowDown: stepBy(value, -big),
      PageDown: stepBy(value, -big),
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    commit(next, false);
  };

  // Opening on click, after the track has taken focus on mousedown, keeps that focus change from blurring the new input.
  const onClick = () => {
    if (!editOnClick.current) return;
    editOnClick.current = false;
    setDraft(format(value));
  };

  const onDraftBlur = () => {
    const parsed = draft === null ? Number.NaN : parse(draft);
    if (!cancelled.current && Number.isFinite(parsed)) commit(parsed, true);
    cancelled.current = false;
    setDraft(null);
  };

  // Returning focus to the track blurs the draft, which commits or discards it.
  const onDraftKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Enter" && event.key !== "Escape") return;
    event.preventDefault();
    cancelled.current = event.key === "Escape";
    trackRef.current?.focus();
  };

  // Shrink and fade the handle while it would collide with the label or value.
  const handleX = Math.max(HANDLE_MIN, fraction * widths.track - HANDLE_INSET);
  const dodge =
    widths.track > 0 &&
    (handleX < TEXT_INSET + widths.label + DODGE_GAP ||
      handleX + HANDLE_WIDTH >
        widths.track - TEXT_INSET - widths.value - DODGE_GAP);
  const handleOpacity = !active ? 0 : dodge ? 0.1 : dragging ? 0.9 : 0.5;

  return (
    <div className="relative h-11 w-full text-sm font-medium">
      <div
        ref={trackRef}
        role="slider"
        tabIndex={editing ? -1 : 0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={format(value)}
        data-active={active || undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={endGesture}
        onClick={onClick}
        onPointerEnter={(e) => e.pointerType === "mouse" && setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        onKeyDown={onKeyDown}
        onFocus={(e) => setFocused(e.currentTarget.matches(":focus-visible"))}
        onBlur={() => setFocused(false)}
        style={
          {
            "--slider-fraction": fraction,
            width: `calc(100% + ${Math.abs(stretch)}px)`,
            translate: `${Math.min(stretch, 0)}px`,
          } as CSSProperties
        }
        className={`group absolute inset-y-0 left-0 cursor-pointer touch-none overflow-clip rounded-lg bg-[color-mix(in_oklab,var(--secondary)_10%,var(--bg))] select-none @container ${
          dragging || instant
            ? "transition-none"
            : "motion-safe:transition-[--slider-fraction,width,translate] motion-safe:duration-400 motion-safe:ease-spring"
        }`}
      >
        <div
          aria-hidden
          className="absolute inset-0 origin-left scale-x-(--slider-fraction) bg-[color-mix(in_oklab,var(--secondary)_18%,var(--bg))] transition-colors duration-150 group-data-active:bg-[color-mix(in_oklab,var(--secondary)_26%,var(--bg))]"
        />

        <div aria-hidden>
          {marks.map((mark) => (
            <span
              key={mark}
              className="absolute top-1/2 h-2 w-px -translate-1/2 rounded-full bg-transparent transition-colors duration-200 group-data-active:bg-[color-mix(in_oklab,var(--secondary)_35%,var(--bg))]"
              style={{ left: `${mark * 100}%` }}
            />
          ))}
        </div>

        <div
          aria-hidden
          style={{
            opacity: handleOpacity,
            scale: `${active ? 1 : 0.25} ${active && dodge ? 0.75 : 1}`,
          }}
          className="absolute top-1/2 left-0 h-5 w-[3px] -translate-y-1/2 translate-x-[max(5px,calc(var(--slider-fraction)*100cqi-9px))] rounded-full bg-primary transition-opacity duration-150 motion-safe:transition-[opacity,scale] motion-safe:duration-250 motion-safe:ease-spring"
        />

        <div className="pointer-events-none absolute inset-0 flex items-center justify-between px-3 text-secondary">
          <span ref={labelRef}>{label}</span>
          {!editing ? (
            <span
              ref={valueRef}
              className="pointer-events-auto relative cursor-text border-b-2 border-transparent tabular-nums transition-colors duration-150 group-data-active:text-[color-mix(in_oklab,var(--secondary)_60%,var(--primary))] after:absolute after:-inset-x-3 after:-inset-y-3 hover:border-[color-mix(in_oklab,var(--secondary)_45%,var(--bg))]"
            >
              {format(value)}
            </span>
          ) : (
            // The hidden copy sizes the input to its text, so the underline is as wide as the value.
            <span className="pointer-events-auto inline-grid">
              <span
                aria-hidden
                className="invisible col-start-1 row-start-1 min-w-[1ch] border-b-2 whitespace-pre tabular-nums"
              >
                {draft || " "}
              </span>
              <input
                autoFocus
                aria-label={label}
                inputMode="decimal"
                size={1}
                value={draft}
                onFocus={(event) => event.currentTarget.select()}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={onDraftKeyDown}
                onBlur={onDraftBlur}
                onPointerDown={(event) => event.stopPropagation()}
                className="col-start-1 row-start-1 w-0 min-w-full border-b-2 border-[color-mix(in_oklab,var(--secondary)_45%,var(--bg))] bg-transparent text-right text-primary tabular-nums outline-none"
              />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
