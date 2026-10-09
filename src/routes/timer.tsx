import { createFileRoute } from "@tanstack/react-router";
import { Infinite } from "iconoir-react";
import { useStore } from "../lib/store";
import {
  formatDuration,
  timerSettings,
  totalDuration,
  type TimerConfig,
} from "../tools/timer/intervals";
import { useIntervalTimer } from "../tools/timer/useIntervalTimer";
import { Button } from "../ui/Button";
import { Checkbox } from "../ui/Checkbox";
import { Dial } from "../ui/Dial";
import { Slider } from "../ui/Slider";
import { Toggle } from "../ui/Toggle";
import { ToolShell } from "../ui/ToolShell";

export const Route = createFileRoute("/timer")({
  head: () => ({ meta: [{ title: "Interval timer · Ding" }] }),
  component: Timer,
});

function Timer() {
  const [config, setConfig] = useStore(timerSettings);
  const timer = useIntervalTimer();
  const { display } = timer;
  const idle = timer.status === "idle";
  const update = (patch: Partial<TimerConfig>) =>
    setConfig((prev) => ({ ...prev, ...patch }));

  const time = display
    ? formatDuration(display.secondsLeft)
    : config.infinite
      ? "∞"
      : formatDuration(totalDuration(config));

  const caption = display
    ? `${display.phase === "work" ? "Work" : "Rest"} · ${display.round}${
        Number.isFinite(display.rounds) ? `/${display.rounds}` : ""
      }`
    : config.infinite
      ? "Until you stop"
      : `${config.rounds} ${config.rounds === 1 ? "round" : "rounds"}`;

  return (
    <ToolShell title="Interval timer">
      <div className="flex flex-1 flex-col items-center justify-center py-6">
        <p
          role="timer"
          className={`text-5xl font-medium tabular-nums transition-colors ${
            timer.status === "paused" ? "text-secondary" : ""
          }`}
        >
          {time}
        </p>
        <p aria-live="polite" className="mt-1 text-sm text-secondary">
          {caption}
        </p>
        <Dial
          className="mt-8 max-w-72"
          fraction={display ? timer.fraction : 1}
          color={
            !display
              ? "color-mix(in oklab, var(--secondary) 10%, var(--bg))"
              : display.phase === "rest"
                ? "var(--violet)"
                : "var(--orange)"
          }
        />
      </div>

      {/* Both control sets share one grid cell, so the dial keeps its place when switching. */}
      <div className="grid">
        <div
          inert={!idle}
          className={`col-start-1 row-start-1 flex flex-col gap-2 ${idle ? "" : "invisible"}`}
        >
          <Slider
            label="Work"
            value={config.work}
            onValueChange={(work) => update({ work })}
            min={5}
            max={600}
            step={5}
            format={formatDuration}
          />
          <Slider
            label="Rest"
            value={config.rest}
            onValueChange={(rest) => update({ rest })}
            min={0}
            max={300}
            step={5}
            format={formatDuration}
          />
          <div className="flex gap-2">
            <div
              inert={config.infinite}
              className={`flex-1 transition-opacity duration-150 ${
                config.infinite ? "opacity-40" : ""
              }`}
            >
              <Slider
                label="Rounds"
                value={config.rounds}
                onValueChange={(rounds) => update({ rounds })}
                min={1}
                max={30}
              />
            </div>
            <Toggle
              label="Repeat until stopped"
              pressed={config.infinite}
              onPressedChange={(infinite) => update({ infinite })}
            >
              <Infinite width={22} height={22} />
            </Toggle>
          </div>
          <Checkbox
            checked={config.halfway}
            onCheckedChange={(halfway) => update({ halfway })}
          >
            <span className="text-sm font-medium text-secondary">
              Ding at half time
            </span>
          </Checkbox>
          <Button className="mt-4" onClick={() => void timer.start(config)}>
            Start
          </Button>
        </div>
        <div
          inert={idle}
          className={`col-start-1 row-start-1 grid grid-cols-2 gap-2 self-end ${idle ? "invisible" : ""}`}
        >
          <Button variant="ghost" onClick={timer.stop}>
            Stop
          </Button>
          {timer.status === "running" ? (
            <Button onClick={timer.pause}>Pause</Button>
          ) : (
            <Button onClick={() => void timer.resume()}>Resume</Button>
          )}
        </div>
      </div>
    </ToolShell>
  );
}
