import { useCallback, useEffect, useRef, useState } from "react";
import { audioNow, playAt, unlockAudio } from "../../lib/audio";
import { useWakeLock } from "../../lib/wakeLock";
import {
  cuesBetween,
  positionAt,
  totalDuration,
  type Phase,
  type TimerConfig,
} from "./intervals";

// Sounds are scheduled this far ahead, so a throttled background tab (timers fire ~1/s) still rings on time.
const LOOKAHEAD = 2;
const SCHEDULE_EVERY = 250;

type Status = "idle" | "running" | "paused";

type Run = {
  config: TimerConfig;
  /** AudioContext time at which the session's elapsed time was 0. */
  origin: number;
  /** Elapsed seconds when paused, otherwise null. */
  pausedAt: number | null;
  /** Elapsed seconds up to which cues have been scheduled. */
  scheduledUntil: number;
  voices: { at: number; voice: ReturnType<typeof playAt> }[];
};

export type Display = {
  phase: Phase;
  /** 1-based. */
  round: number;
  /** Infinity in infinite mode. */
  rounds: number;
  secondsLeft: number;
};

const elapsedOf = (run: Run) => run.pausedAt ?? audioNow() - run.origin;

const silence = (run: Run) => {
  for (const { voice } of run.voices) voice.stop();
  run.voices = [];
};

function displayAt(config: TimerConfig, t: number): Display | null {
  const position = positionAt(config, t);
  if (!position) return null;
  return {
    phase: position.phase,
    round: position.round + 1,
    rounds: config.infinite ? Infinity : config.rounds,
    secondsLeft: Math.ceil(position.duration - position.elapsed),
  };
}

const sameDisplay = (a: Display | null, b: Display | null) =>
  a?.phase === b?.phase &&
  a?.round === b?.round &&
  a?.secondsLeft === b?.secondsLeft;

export function useIntervalTimer() {
  const run = useRef<Run | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [display, setDisplay] = useState<Display | null>(null);

  useWakeLock(status === "running");

  useEffect(() => {
    if (status !== "running") return;

    const schedule = () => {
      const current = run.current;
      if (!current) return;
      const now = elapsedOf(current);
      if (now >= totalDuration(current.config)) {
        // Leave the voices alone: the finishing dings are still ringing.
        run.current = null;
        setDisplay(null);
        setStatus("idle");
        return;
      }
      const until = now + LOOKAHEAD;
      for (const cue of cuesBetween(
        current.config,
        current.scheduledUntil,
        until,
      ))
        current.voices.push({
          at: cue.at,
          voice: playAt(cue.sound, current.origin + cue.at),
        });
      current.scheduledUntil = until;
      current.voices = current.voices.filter(({ at }) => at > now - 5);
    };

    let frame = requestAnimationFrame(function draw() {
      const current = run.current;
      if (current) {
        const next = displayAt(current.config, elapsedOf(current));
        if (next) setDisplay((prev) => (sameDisplay(prev, next) ? prev : next));
      }
      frame = requestAnimationFrame(draw);
    });
    const interval = setInterval(schedule, SCHEDULE_EVERY);
    schedule();

    return () => {
      cancelAnimationFrame(frame);
      clearInterval(interval);
    };
  }, [status]);

  useEffect(
    () => () => {
      if (run.current) silence(run.current);
    },
    [],
  );

  const start = async (config: TimerConfig) => {
    if (run.current) return;
    await unlockAudio();
    if (run.current) return;
    run.current = {
      config,
      origin: audioNow(),
      pausedAt: null,
      scheduledUntil: 0,
      voices: [],
    };
    setDisplay(displayAt(config, 0));
    setStatus("running");
  };

  const pause = () => {
    const current = run.current;
    if (!current || current.pausedAt !== null) return;
    current.pausedAt = elapsedOf(current);
    silence(current);
    setStatus("paused");
  };

  const resume = async () => {
    const current = run.current;
    if (!current || current.pausedAt === null) return;
    await unlockAudio();
    current.origin = audioNow() - current.pausedAt;
    current.scheduledUntil = current.pausedAt;
    current.pausedAt = null;
    setStatus("running");
  };

  const stop = () => {
    if (run.current) silence(run.current);
    run.current = null;
    setDisplay(null);
    setStatus("idle");
  };

  /** Share of the current phase that has passed, 0–1. Read per frame by the dial. */
  const fraction = useCallback(() => {
    const current = run.current;
    if (!current) return 0;
    const position = positionAt(current.config, elapsedOf(current));
    return position ? position.elapsed / position.duration : 1;
  }, []);

  return { status, display, fraction, start, pause, resume, stop };
}
