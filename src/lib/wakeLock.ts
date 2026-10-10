import { useEffect } from "react";

/** Keeps the screen on while `active`. The browser drops the lock when the page is hidden, so it is re-requested on return. */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let sentinel: WakeLockSentinel | undefined;
    let cancelled = false;

    const acquire = async () => {
      if (document.visibilityState !== "visible") return;
      if (sentinel && !sentinel.released) return;
      try {
        const next = await navigator.wakeLock.request("screen");
        if (cancelled) void next.release();
        else sentinel = next;
      } catch {
        // Denied (e.g. battery saver): the timer still works, the screen may dim.
      }
    };

    void acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", acquire);
      void sentinel?.release();
    };
  }, [active]);
}
