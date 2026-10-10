import type { SoundName } from "../../lib/audio";
import { createStore } from "../../lib/store";
import type { SliderSegment } from "../../ui/Slider";

export type TimerConfig = {
  /** Seconds. */
  work: number;
  /** Seconds. */
  rest: number;
  rounds: number;
  /** Repeat work and rest until stopped; `rounds` is ignored. */
  infinite: boolean;
  /** Ring halfway through each work phase, e.g. to switch sides. */
  halfway: boolean;
};

export const timerSettings = createStore<TimerConfig>({
  key: "timer",
  version: 1,
  sync: true,
  defaults: {
    work: 30,
    rest: 10,
    rounds: 8,
    infinite: false,
    halfway: false,
  },
});

// Short intervals get most of the track and fine steps; longer, pomodoro-style
// ones get coarser steps. Seconds.
export const WORK_MIN = 5;
export const workScale: SliderSegment[] = [
  { to: 60, step: 5, share: 0.3 },
  { to: 5 * 60, step: 15, share: 0.2 },
  { to: 10 * 60, step: 30, share: 0.1 },
  { to: 30 * 60, step: 60, share: 0.25 },
  { to: 90 * 60, step: 5 * 60, share: 0.15 },
];

export const REST_MIN = 0;
export const restScale: SliderSegment[] = [
  { to: 60, step: 5, share: 0.35 },
  { to: 5 * 60, step: 15, share: 0.25 },
  { to: 10 * 60, step: 30, share: 0.15 },
  { to: 30 * 60, step: 60, share: 0.25 },
];

export type Phase = "work" | "rest";

export type Position = {
  phase: Phase;
  /** 0-based. */
  round: number;
  /** Seconds into the phase. */
  elapsed: number;
  duration: number;
};

// The last round has no rest after it.
export const totalDuration = ({ work, rest, rounds, infinite }: TimerConfig) =>
  infinite ? Infinity : rounds * work + (rounds - 1) * rest;

/** Where the session stands `t` seconds after it started; null once it has ended. */
export function positionAt(config: TimerConfig, t: number): Position | null {
  if (t >= totalDuration(config)) return null;
  const cycle = config.work + config.rest;
  const round = Math.floor(Math.max(0, t) / cycle);
  const within = Math.max(0, t) - round * cycle;
  return within < config.work
    ? { phase: "work", round, elapsed: within, duration: config.work }
    : {
        phase: "rest",
        round,
        elapsed: within - config.work,
        duration: config.rest,
      };
}

export type Cue = { at: number; sound: SoundName };

const COUNTDOWN_TICKS = 3;
const FINISH_DINGS = [0, 0.35, 0.7];

function countdown(phaseEnd: number, duration: number): Cue[] {
  const cues: Cue[] = [];
  for (let k = COUNTDOWN_TICKS; k >= 1; k--)
    if (k < duration) cues.push({ at: phaseEnd - k, sound: "tick" });
  return cues;
}

/** Sounds due in [from, to), in seconds since the session started. */
export function cuesBetween(
  config: TimerConfig,
  from: number,
  to: number,
): Cue[] {
  const { work, rest } = config;
  const cycle = work + rest;
  const lastRound = config.infinite ? Infinity : config.rounds - 1;
  const first = Math.max(0, Math.floor(from / cycle) - 1);
  const last = Math.min(lastRound, Math.floor(to / cycle));

  const cues: Cue[] = [];
  for (let round = first; round <= last; round++) {
    const start = round * cycle;
    cues.push({ at: start, sound: "ding" });
    if (config.halfway) cues.push({ at: start + work / 2, sound: "halfway" });
    cues.push(...countdown(start + work, work));
    if (round < lastRound) {
      if (rest > 0) cues.push({ at: start + work, sound: "restBell" });
      cues.push(...countdown(start + cycle, rest));
    } else {
      for (const offset of FINISH_DINGS)
        cues.push({ at: start + work + offset, sound: "ding" });
    }
  }
  return cues.filter((cue) => cue.at >= from && cue.at < to);
}

/** "0:30", "12:05", "1:02:05". */
export function formatDuration(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}
