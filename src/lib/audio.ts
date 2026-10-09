// Uses the vanilla @web-kits/audio API on purpose: its React `useSound` hook
// stays silent under prefers-reduced-motion, and our sounds carry information
// (a phase ended), so they must play regardless.
import {
  defineSound,
  ensureReady,
  getMasterBus,
  setMasterVolume,
  type Layer,
  type SoundDefinition,
  type VoiceHandle,
} from "@web-kits/audio";
import { createStore, useStore } from "./store";

export const audioSettings = createStore({
  key: "audio",
  version: 1,
  sync: true,
  defaults: { volume: 0.8, muted: false },
});

export const useAudioSettings = () => useStore(audioSettings);

// Inharmonic partials (1, 2.76, 5.4) are what make a sine stack sound like a bell.
const bell = (frequency: number, decay: number): SoundDefinition => ({
  layers: [
    {
      source: { type: "sine", frequency },
      envelope: { attack: 0.002, decay },
      gain: 0.4,
    },
    {
      source: { type: "sine", frequency: frequency * 2.76 },
      envelope: { attack: 0.002, decay: decay * 0.4 },
      gain: 0.12,
    },
    {
      source: { type: "sine", frequency: frequency * 5.4 },
      envelope: { attack: 0.001, decay: decay * 0.15 },
      gain: 0.05,
    },
  ],
});

// Placeholders: tune these once the tools exist.
const sounds = {
  ding: bell(1046.5, 1.6),
  restBell: bell(523.25, 2.2),
  tick: {
    source: { type: "triangle", frequency: 1800 },
    envelope: { decay: 0.03 },
    gain: 0.2,
  },
} satisfies Record<string, SoundDefinition>;

export type SoundName = keyof typeof sounds;

let unlocked = false;

const applyVolume = () => {
  const { volume, muted } = audioSettings.get();
  setMasterVolume(muted ? 0 : volume);
};

audioSettings.subscribe(() => {
  if (unlocked) applyVolume();
});

/**
 * Starts the shared AudioContext. Call it inside the click handler that
 * starts anything audible (iOS only allows this during a user gesture).
 */
export async function unlockAudio() {
  await ensureReady();
  unlocked = true;
  applyVolume();
}

/** The AudioContext clock in seconds; the time base for `playAt`. */
export const audioNow = () => getMasterBus().context.currentTime;

export function play(name: SoundName): VoiceHandle {
  return playAt(name, audioNow());
}

/**
 * Schedules a sound at an absolute AudioContext time (see `audioNow`).
 * The library has no public start-time option, so this offsets every
 * layer's `delay` from the current time. Stop the handle to cancel.
 */
export function playAt(name: SoundName, when: number): VoiceHandle {
  applyVolume();
  const offset = Math.max(0, when - audioNow());
  const definition: SoundDefinition = sounds[name];
  const layers: Layer[] =
    "layers" in definition ? definition.layers : [definition];
  return defineSound({
    layers: layers.map((layer) => ({
      ...layer,
      delay: (layer.delay ?? 0) + offset,
    })),
    effects: "layers" in definition ? definition.effects : undefined,
  })();
}
