import * as bluesky from "./bluesky";
import * as mastodon from "./mastodon";
import {
  draft,
  imageFiles,
  posting,
  type Job,
  type PlatformJob,
  type SentPost,
} from "./stores";
import type { Platform } from "./text";

// One lock per platform, shared by every tab, so only one tab posts a thread
// at a time. The browser releases it when that tab closes.
const lockName = (platform: Platform) => `ding:crosspost-posting:${platform}`;

/** Whether some tab, this one or another, is posting to `platform` right now. */
export async function isRunning(platform: Platform) {
  const { held = [] } = await navigator.locks.query();
  return held.some((lock) => lock.name === lockName(platform));
}

const updatePlatform = (
  platform: Platform,
  update: (job: PlatformJob) => PlatformJob,
) =>
  posting.set((prev) => {
    const current = prev.job?.platforms[platform];
    if (!prev.job || !current) return prev;
    return {
      ...prev,
      job: {
        ...prev.job,
        platforms: { ...prev.job.platforms, [platform]: update(current) },
      },
    };
  });

const setAt = <T>(list: T[], i: number, value: T) =>
  list.map((item, j) => (j === i ? value : item));

async function send(
  platform: Platform,
  job: Job,
  state: PlatformJob,
  i: number,
): Promise<SentPost> {
  const post = state.posts[i];
  const root = state.sent[0] ?? undefined;
  const parent = state.sent[i - 1] ?? undefined;

  // A post that was attempted may exist even though the answer never arrived.
  const key = state.keys[i];
  const attemptedAt = state.attemptedAt[i];
  if (key && attemptedAt) {
    const existing =
      platform === "bluesky"
        ? await bluesky.findPost(key)
        : await mastodon.findPost(attemptedAt, parent, {
            text: post.text,
            images: post.images.length,
          });
    if (existing) return existing;
  }
  const fixedKey =
    key ?? (platform === "bluesky" ? bluesky.tid() : crypto.randomUUID());
  updatePlatform(platform, (s) => ({
    ...s,
    keys: setAt(s.keys, i, fixedKey),
    attemptedAt: setAt(s.attemptedAt, i, Date.now()),
  }));

  const images = [];
  for (const id of post.images) {
    const file = await imageFiles.get(id);
    if (!file) throw new Error("An image is missing from this device");
    images.push({ file, ...job.images[id] });
  }
  return platform === "bluesky"
    ? bluesky.createPost({
        text: post.text,
        images,
        root,
        parent,
        rkey: fixedKey,
        mentions: job.mentions,
      })
    : mastodon.createPost({ text: post.text, images, parent, key: fixedKey });
}

/**
 * Posts what's left of `platform`'s thread, in order, each replying to the one
 * before. Does nothing while another run, in any tab, holds the platform.
 */
export const run = (platform: Platform) =>
  navigator.locks.request(
    lockName(platform),
    { ifAvailable: true },
    (lock) => lock && post(platform),
  );

async function post(platform: Platform) {
  updatePlatform(platform, (s) => ({
    ...s,
    status: "posting",
    error: undefined,
  }));
  let i = 0;
  try {
    for (; ; i++) {
      const job = posting.get().job;
      const state = job?.platforms[platform];
      if (!job || !state || i >= state.posts.length) break;
      if (state.sent[i]) continue;
      const sent = await send(platform, job, state, i);
      updatePlatform(platform, (s) => ({ ...s, sent: setAt(s.sent, i, sent) }));
    }
    updatePlatform(platform, (s) => ({ ...s, status: "done" }));
  } catch (error) {
    const total = posting.get().job?.platforms[platform]?.posts.length ?? 0;
    const message = error instanceof Error ? error.message : String(error);
    updatePlatform(platform, (s) => ({
      ...s,
      status: "failed",
      error: total > 1 ? `Post ${i + 1} of ${total}: ${message}` : message,
    }));
  }
  finishIfDone();
}

/** Once every platform is through, keep the links and clear the composer. */
function finishIfDone() {
  const { job } = posting.get();
  if (!job) return;
  const platforms = Object.entries(job.platforms) as [Platform, PlatformJob][];
  if (platforms.some(([, s]) => s.status !== "done")) return;
  posting.set({
    job: null,
    posted: Object.fromEntries(
      platforms.map(([platform, s]) => [platform, s.sent[0]?.url ?? ""]),
    ),
  });
  for (const image of draft.get().images) void imageFiles.delete(image.id);
  draft.reset();
}

export function start(job: Job) {
  posting.set({ job, posted: null });
  for (const platform of Object.keys(job.platforms) as Platform[])
    void run(platform);
}

/** Gives up on the rest of the thread; the draft stays as it was. */
export function discard() {
  posting.set((prev) => ({ ...prev, job: null }));
}
