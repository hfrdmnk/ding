// Android only. iOS Safari has no Vibration API, and its `<input switch>`
// workaround only fires on a real tap on the switch, never while dragging.
const TICK_MS = 10;

/** A short tick, e.g. when a slider passes a step. Call from touch handlers only. */
export function tick() {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  // Chrome blocks (and logs) vibration before the first tap on the page.
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive)
    return;
  navigator.vibrate(TICK_MS);
}
