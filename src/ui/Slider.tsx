import { Slider as BaseSlider } from "@base-ui/react/slider";
import { useRef, useState, type KeyboardEvent } from "react";

type SliderProps = {
  label: string;
  value: number;
  onValueChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  format?: (value: number) => string;
};

const MAX_MARKS = 30;
// Half the thumb's hit area: the line sits this far in from either edge at min/max.
const INSET = "8px";

// Accepts what `format` shows for durations ("1:30") as well as plain numbers.
function parse(text: string): number {
  const time = text.trim().match(/^(\d+):(\d{1,2})$/);
  if (time) return Number(time[1]) * 60 + Number(time[2]);
  return Number.parseFloat(text);
}

export function Slider({
  label,
  value,
  onValueChange,
  min,
  max,
  step = 1,
  format = String,
}: SliderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<string | null>(null);

  const steps = Math.round((max - min) / step);
  const marks = steps <= MAX_MARKS ? steps : 10;

  const cancelled = useRef(false);

  const onDraftBlur = () => {
    const parsed = draft === null ? Number.NaN : parse(draft);
    if (!cancelled.current && Number.isFinite(parsed)) {
      const snapped = min + Math.round((parsed - min) / step) * step;
      onValueChange(Math.min(max, Math.max(min, snapped)));
    }
    cancelled.current = false;
    setDraft(null);
  };

  const onThumbKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    setDraft(format(value));
  };

  // Returning focus to the thumb blurs the draft, which commits or discards it.
  const onDraftKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Enter" && event.key !== "Escape") return;
    event.preventDefault();
    cancelled.current = event.key === "Escape";
    inputRef.current?.focus();
  };

  return (
    <BaseSlider.Root
      value={value}
      onValueChange={onValueChange}
      min={min}
      max={max}
      step={step}
      thumbAlignment="edge"
      className="group relative w-full text-[13px] font-medium"
    >
      <BaseSlider.Control className="relative h-11 cursor-pointer touch-none overflow-hidden rounded-lg bg-[color-mix(in_oklab,var(--secondary)_10%,var(--bg))] select-none">
        <BaseSlider.Track className="h-full">
          <BaseSlider.Indicator className="h-full bg-[color-mix(in_oklab,var(--secondary)_18%,var(--bg))] transition-colors duration-150 group-data-dragging:bg-[color-mix(in_oklab,var(--secondary)_26%,var(--bg))]" />
          <div
            aria-hidden
            className="absolute inset-0 opacity-0 transition-opacity duration-200 group-data-dragging:opacity-100"
          >
            {Array.from({ length: marks - 1 }, (_, i) => (
              <span
                key={i}
                className="absolute top-1/2 h-2 w-px -translate-y-1/2 bg-[color-mix(in_oklab,var(--secondary)_35%,var(--bg))]"
                style={{
                  left: `calc(${INSET} + (100% - 2 * ${INSET}) * ${(i + 1) / marks})`,
                }}
              />
            ))}
          </div>
          <BaseSlider.Thumb
            inputRef={inputRef}
            onKeyDown={onThumbKeyDown}
            getAriaValueText={(_, v) => format(v)}
            className="flex h-full w-4 justify-center outline-none before:my-auto before:h-5 before:w-[3px] before:rounded-full before:bg-primary has-focus-visible:before:outline-2 has-focus-visible:before:outline-offset-2 has-focus-visible:before:outline-primary has-focus-visible:before:outline-solid"
          />
        </BaseSlider.Track>
      </BaseSlider.Control>

      <div className="pointer-events-none absolute inset-0 flex items-center justify-between px-3 text-secondary">
        <BaseSlider.Label>{label}</BaseSlider.Label>
        {draft === null ? (
          <BaseSlider.Value className="tabular-nums transition-colors duration-150 group-data-dragging:text-[color-mix(in_oklab,var(--secondary)_60%,var(--primary))]">
            {(_, values) => format(values[0])}
          </BaseSlider.Value>
        ) : (
          <input
            autoFocus
            aria-label={label}
            inputMode="decimal"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onDraftKeyDown}
            onBlur={onDraftBlur}
            className="pointer-events-auto w-20 bg-transparent text-right text-primary tabular-nums outline-none"
          />
        )}
      </div>
    </BaseSlider.Root>
  );
}
