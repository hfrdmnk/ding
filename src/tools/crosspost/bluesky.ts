import type {
  BrowserOAuthClient,
  OAuthSession,
} from "@atproto/oauth-client-browser";
import { clientMetadata as metadata } from "./oauthClientMetadata";
import {
  accounts,
  type BlueskyAccount,
  type Person,
  type SentPost,
} from "./stores";
import { prepareImage } from "./images";
import { blueskyText, byteLength, findEntities, findLinks } from "./text";

const APPVIEW = "https://public.api.bsky.app";
const CARDYB = "https://cardyb.bsky.app/v1";
const PRODUCTION = new URL(metadata.client_id).origin;

export class XrpcError extends Error {
  readonly status: number;
  readonly error: string;
  constructor(status: number, error: string, message: string) {
    super(message);
    this.status = status;
    this.error = error;
  }
}

type Fetcher = (path: string, init: RequestInit) => Promise<Response>;

const publicFetch: Fetcher = (path, init) =>
  fetch(new URL(path, APPVIEW), init);

async function xrpc<T>(
  fetcher: Fetcher,
  method: string,
  { params, body }: { params?: Record<string, string>; body?: unknown } = {},
): Promise<T> {
  const query = params ? `?${new URLSearchParams(params)}` : "";
  const isBlob = body instanceof Blob;
  const response = await fetcher(`/xrpc/${method}${query}`, {
    method: body === undefined ? "GET" : "POST",
    headers:
      body === undefined
        ? undefined
        : { "content-type": isBlob ? body.type : "application/json" },
    body: isBlob ? body : body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new XrpcError(
      response.status,
      data.error ?? "",
      data.message ?? data.error ?? `Bluesky answered ${response.status}`,
    );
  return data as T;
}

async function resolveDid(handle: string) {
  if (handle.startsWith("did:")) return handle;
  try {
    const { did } = await xrpc<{ did: string }>(
      publicFetch,
      "com.atproto.identity.resolveHandle",
      { params: { handle } },
    );
    return did;
  } catch {
    const response = await fetch(`https://${handle}/.well-known/atproto-did`);
    if (!response.ok) throw new Error(`Couldn't find the handle ${handle}`);
    return (await response.text()).trim();
  }
}

// Loopback clients must use an IP address: a sign-in from "localhost" would
// return to 127.0.0.1, a different origin with different storage.
const isLoopback = () => ["127.0.0.1", "[::1]"].includes(location.hostname);

/**
 * OAuth needs a client ID Bluesky can look up: the metadata file on the
 * production site, or a loopback client on 127.0.0.1 for development.
 */
export const canSignIn = () => isLoopback() || location.origin === PRODUCTION;

let client: Promise<BrowserOAuthClient> | undefined;

// Loaded on first use, so prerendering never evaluates browser-only code.
const oauthClient = () =>
  (client ??= import("@atproto/oauth-client-browser").then(
    ({ BrowserOAuthClient }) =>
      isLoopback()
        ? BrowserOAuthClient.load({
            // A loopback client ID has no path; only its redirect URI does.
            clientId: `http://localhost?${new URLSearchParams({
              redirect_uri: `${location.origin}/crosspost`,
              scope: metadata.scope,
            })}`,
            handleResolver: APPVIEW,
          })
        : new BrowserOAuthClient({
            clientMetadata: metadata,
            handleResolver: APPVIEW,
          }),
  ));

let initialized: ReturnType<BrowserOAuthClient["init"]> | undefined;
const ready = () => (initialized ??= oauthClient().then((c) => c.init()));

/**
 * Finishes a sign-in that redirected back here, or restores the last session.
 * Runs once per page load, as the OAuth client requires.
 */
export async function init(): Promise<BlueskyAccount | null> {
  const result = await ready();
  if (!result || result.state !== "ding") return null;
  const { handle } = await xrpc<{ handle: string }>(
    publicFetch,
    "app.bsky.actor.getProfile",
    { params: { actor: result.session.did } },
  );
  return { did: result.session.did, handle };
}

/** Sends the browser to the account's sign-in page; it comes back to /crosspost. */
export async function signIn(handle: string) {
  const identifier = handle.trim().replace(/^@/, "").toLowerCase();
  await (await oauthClient()).signIn(identifier, { state: "ding" });
}

/** Revokes the session on the server and forgets it here. */
export async function signOut(did: string) {
  await (await oauthClient()).revoke(did);
}

async function session(): Promise<OAuthSession> {
  const account = accounts.get().bluesky;
  if (!account) throw new Error("Bluesky isn't connected");
  // A failed sign-in callback doesn't stop an existing session from working.
  await ready().catch(() => undefined);
  try {
    return await (await oauthClient()).restore(account.did);
  } catch (error) {
    // The client deletes the stored session on exactly these errors. Others,
    // such as network failures, leave it intact for a retry.
    const { isExpectedSessionError } =
      await import("@atproto/oauth-client-browser");
    if (isExpectedSessionError(error))
      throw new Error("Bluesky signed you out. Connect it again in settings.", {
        cause: error,
      });
    throw error;
  }
}

const sessionFetch =
  (s: OAuthSession): Fetcher =>
  (path, init) =>
    s.fetchHandler(path, init);

/**
 * Checks the session still works; updates the stored handle. Doesn't force a
 * token refresh: each refresh token works once, and a page that closes before
 * storing the new one leaves a used token that makes the server end the session.
 */
export async function check() {
  const s = await session();
  const { handle } = await xrpc<{ handle: string }>(
    sessionFetch(s),
    "com.atproto.server.getSession",
  );
  accounts.set((prev) =>
    prev.bluesky ? { ...prev, bluesky: { ...prev.bluesky, handle } } : prev,
  );
  return handle;
}

export const searchPeople = (q: string) =>
  xrpc<{
    actors: {
      did: string;
      handle: string;
      displayName?: string;
      avatar?: string;
    }[];
  }>(publicFetch, "app.bsky.actor.searchActorsTypeahead", {
    params: { q, limit: "8" },
  }).then((r) => r.actors);

// Record keys are TIDs: microseconds since 1970 and a clock id, in sortable base32.
const S32 = "234567abcdefghijklmnopqrstuvwxyz";
let lastMicros = 0;
export function tid() {
  lastMicros = Math.max(Date.now() * 1000, lastMicros + 1);
  let n =
    (BigInt(lastMicros) << 10n) | BigInt(Math.floor(Math.random() * 1024));
  let out = "";
  for (let i = 0; i < 13; i++) {
    out = S32[Number(n & 31n)] + out;
    n >>= 5n;
  }
  return out;
}

const postUrl = (did: string, uri: string) =>
  `https://bsky.app/profile/${did}/post/${uri.split("/").pop()}`;

/** The post with record key `rkey`, if an earlier attempt created it. */
export async function findPost(rkey: string): Promise<SentPost | null> {
  const s = await session();
  try {
    const { uri, cid } = await xrpc<{ uri: string; cid: string }>(
      sessionFetch(s),
      "com.atproto.repo.getRecord",
      { params: { repo: s.did, collection: "app.bsky.feed.post", rkey } },
    );
    return { uri, cid, url: postUrl(s.did, uri) };
  } catch (error) {
    if (error instanceof XrpcError && error.status === 400) return null;
    throw error;
  }
}

const utf8Offset = (text: string, index: number) =>
  byteLength(text.slice(0, index));

async function facets(text: string, mentions: Record<string, Person>) {
  const { text: stored, links } = blueskyText(text);
  const ranges = [
    ...links.map((link) => ({ ...link, kind: "link" as const })),
    ...findEntities(stored, "bluesky").filter((e) => e.kind !== "link"),
  ];
  const known = new Map(
    Object.values(mentions).flatMap((p) =>
      p.bluesky ? [[p.bluesky.handle, p.bluesky.did] as const] : [],
    ),
  );
  const result = [];
  for (const range of ranges) {
    let feature;
    if (range.kind === "link")
      feature = { $type: "app.bsky.richtext.facet#link", uri: range.uri };
    else if (range.kind === "tag")
      feature = { $type: "app.bsky.richtext.facet#tag", tag: range.tag };
    else {
      const handle = range.handle.toLowerCase();
      const did =
        known.get(handle) ?? (await resolveDid(handle).catch(() => null));
      // Someone who isn't on Bluesky stays plain text.
      if (!did) continue;
      feature = { $type: "app.bsky.richtext.facet#mention", did };
    }
    result.push({
      index: {
        byteStart: utf8Offset(stored, range.start),
        byteEnd: utf8Offset(stored, range.end),
      },
      features: [feature],
    });
  }
  return { text: stored, facets: result };
}

/**
 * A link card made the way Bluesky's app makes one: Bluesky's preview service
 * reads the page, and for a standard.site page also returns its document and
 * publication records, which Bluesky shows as an article card.
 */
async function linkCard(pds: Fetcher, uri: string) {
  const response = await fetch(
    `${CARDYB}/extract?${new URLSearchParams({ url: uri })}`,
    { signal: AbortSignal.timeout(15_000) },
  );
  const meta: {
    title?: string;
    description?: string;
    image?: string;
    associated_refs?: { uri: string; cid: string }[];
  } = await response.json();
  if (!response.ok) throw new Error(`No preview for ${uri}`);
  // Without its image the card still shows, so a failed image only drops it.
  const thumb = meta.image
    ? await fetch(meta.image)
        .then((r) => r.blob())
        .then(prepareImage)
        .then(({ file }) =>
          xrpc<{ blob: unknown }>(pds, "com.atproto.repo.uploadBlob", {
            body: file,
          }),
        )
        .then((r) => r.blob)
        .catch(() => undefined)
    : undefined;
  return {
    uri,
    title: meta.title ?? "",
    description: meta.description ?? "",
    thumb,
    associatedRefs: meta.associated_refs,
  };
}

export async function createPost({
  text,
  images,
  root,
  parent,
  rkey,
  mentions,
}: {
  text: string;
  images: { file: Blob; alt: string; width: number; height: number }[];
  root?: SentPost;
  parent?: SentPost;
  rkey: string;
  mentions: Record<string, Person>;
}): Promise<SentPost> {
  const s = await session();
  const pds = sessionFetch(s);
  const uploaded = [];
  for (const image of images) {
    const { blob } = await xrpc<{ blob: unknown }>(
      pds,
      "com.atproto.repo.uploadBlob",
      { body: image.file },
    );
    uploaded.push({
      image: blob,
      alt: image.alt,
      aspectRatio: { width: image.width, height: image.height },
    });
  }
  // A post holds one embed, so images win over a link card, as in Bluesky's
  // app. Without a card the link still works, so a failed preview doesn't
  // stop the post.
  const link = findLinks(text)[0]?.uri;
  const card =
    uploaded.length === 0 && link
      ? await linkCard(pds, link).catch(() => undefined)
      : undefined;
  const record = {
    $type: "app.bsky.feed.post",
    ...(await facets(text, mentions)),
    createdAt: new Date().toISOString(),
    ...(uploaded.length > 0 && {
      embed: { $type: "app.bsky.embed.images", images: uploaded },
    }),
    ...(card && {
      embed: { $type: "app.bsky.embed.external", external: card },
    }),
    ...(root &&
      parent && {
        reply: {
          root: { uri: root.uri, cid: root.cid },
          parent: { uri: parent.uri, cid: parent.cid },
        },
      }),
  };
  const { uri, cid } = await xrpc<{ uri: string; cid: string }>(
    pds,
    "com.atproto.repo.createRecord",
    { body: { repo: s.did, collection: "app.bsky.feed.post", rkey, record } },
  );
  return { uri, cid, url: postUrl(s.did, uri) };
}
