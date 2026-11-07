import { createFileStore, createStore } from "../../lib/store";
import type { Platform } from "./text";

/** Tokens live in the OAuth client's own IndexedDB, bound to a key that can't be read out. */
export type BlueskyAccount = { did: string; handle: string };

export type MastodonAccount = {
  /** Origin, e.g. https://mastodon.social. */
  instance: string;
  /** The app Ding registered on the instance, needed to revoke the token. */
  clientId: string;
  clientSecret: string;
  token: string;
  id: string;
  acct: string;
  maxChars: number;
  urlLength: number;
  altLimit: number;
};

type Accounts = {
  bluesky: BlueskyAccount | null;
  mastodon: MastodonAccount | null;
  claudeKey: string;
};

// Credentials and the API key never sync and never leave the device except in
// calls to Bluesky, Mastodon and Anthropic.
export const accounts = createStore<Accounts>({
  key: "crosspost-accounts",
  // v1 held a Bluesky app password and a Mastodon token without its app, which
  // can't be revoked. Migrating drops both, and with them the old stored key.
  version: 2,
  defaults: { bluesky: null, mastodon: null, claudeKey: "" },
  sync: false,
  migrate: (old) => ({
    bluesky: null,
    mastodon: null,
    claudeKey: (old as { claudeKey?: string }).claudeKey ?? "",
  }),
});

/** A Mastodon sign-in waiting for the instance to redirect back. */
export const mastodonSignIn = createStore<{
  instance: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  state: string;
  verifier: string;
} | null>({
  key: "crosspost-mastodon-signin",
  version: 1,
  defaults: null,
  sync: false,
});

export const preferences = createStore<{
  numbering: boolean;
  enabled: Record<Platform, boolean>;
}>({
  key: "crosspost-preferences",
  version: 1,
  defaults: { numbering: false, enabled: { bluesky: true, mastodon: true } },
  sync: true,
});

/** Someone picked from autocomplete, with their account on each platform they're on. */
export type Person = {
  name: string;
  avatar?: string;
  bluesky?: { handle: string; did: string };
  mastodon?: { acct: string };
  /** Set by clicking the mention: what it says on a platform instead of the account there. */
  custom?: Partial<Record<Platform, string>>;
};

export type DraftImage = {
  id: string;
  /** `[image n]` in a post's text places the image there. */
  n: number;
  alt: string;
  width: number;
  height: number;
};

export const draft = createStore<{
  /** One entry per post of the thread. */
  posts: string[];
  images: DraftImage[];
  /** Keyed by the mention as written, without the @ (a handle or user@instance). */
  mentions: Record<string, Person>;
}>({
  key: "crosspost-draft",
  // v1 (one text with --- lines and anchored images) never shipped, so it has no migration.
  version: 2,
  defaults: { posts: [""], images: [], mentions: {} },
  sync: false,
});

/** Image files of the draft, by DraftImage id. */
export const imageFiles = createFileStore("crosspost-images");

export type SentPost = { uri: string; cid: string; url: string };

export type PlatformJob = {
  /** `post` is the index of the editor post each one comes from. */
  posts: { post: number; text: string; images: string[] }[];
  sent: (SentPost | null)[];
  /**
   * Bluesky record key or Mastodon idempotency key per post, saved before its
   * first attempt. A post with a key may already exist, so a retry looks for
   * it before creating it again.
   */
  keys: (string | null)[];
  attemptedAt: (number | null)[];
  status: "posting" | "failed" | "done";
  error?: string;
};

export type Job = {
  images: Record<string, { alt: string; width: number; height: number }>;
  mentions: Record<string, Person>;
  platforms: Partial<Record<Platform, PlatformJob>>;
};

export const posting = createStore<{
  job: Job | null;
  /** Links to the first post of the last finished thread. */
  posted: Partial<Record<Platform, string>> | null;
}>({
  key: "crosspost-posting",
  version: 1,
  defaults: { job: null, posted: null },
  sync: false,
});
