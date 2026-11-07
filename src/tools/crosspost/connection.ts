import * as bluesky from "./bluesky";
import * as mastodon from "./mastodon";
import type { Platform } from "./text";

/** Whether a connected account works. No entry yet means it's being checked. */
export type Check = { state: "ok" | "error"; message?: string };

export const checkLabel = (check: Check | undefined) =>
  !check
    ? "Checking…"
    : check.state === "ok"
      ? "Connected"
      : `Can't connect: ${check.message}`;

export async function checkConnection(platform: Platform): Promise<Check> {
  try {
    await (platform === "bluesky" ? bluesky.check() : mastodon.check());
    return { state: "ok" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { state: "error", message };
  }
}
