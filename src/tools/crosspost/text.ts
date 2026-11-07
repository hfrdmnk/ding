// Counting, entity detection and image shortcodes for Bluesky and Mastodon.
// Pure functions: they run during render and in the prerender.

const graphemeSegmenter = new Intl.Segmenter(undefined, {
  granularity: "grapheme",
});
const encoder = new TextEncoder();

export const graphemes = (text: string) =>
  Array.from(graphemeSegmenter.segment(text)).length;

export const byteLength = (text: string) => encoder.encode(text).length;

export type Entity = {
  /** UTF-16 offsets into the text. */
  start: number;
  end: number;
} & (
  | { kind: "link"; uri: string }
  | { kind: "mention"; handle: string }
  | { kind: "tag"; tag: string }
);

// Detection follows Bluesky's own (@atproto/api rich-text/detection.ts), except
// that links need a scheme: Mastodon only links those, so both platforms agree.
const LINK_RE = /(^|\s|\()(https?:\/\/\S+)/gi;
const MENTION_RE = /(^|\s|\()@([a-zA-Z0-9.-]+)(\b)/g;
const TAG_RE =
  // The classes list invisible characters on purpose, as Bluesky's do.
  // eslint-disable-next-line no-misleading-character-class
  /(^|\s)[#＃]((?!\ufe0f)[^\s\u00AD\u2060\u200A\u200B\u200C\u200D\u20e2]*[^\d\s\p{P}\u00AD\u2060\u200A\u200B\u200C\u200D\u20e2]+[^\s\u00AD\u2060\u200A\u200B\u200C\u200D\u20e2]*)?/gu;
const DOMAIN_RE = /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i;

export function findLinks(text: string) {
  const links: Extract<Entity, { kind: "link" }>[] = [];
  for (const match of text.matchAll(LINK_RE)) {
    const start = match.index + match[1].length;
    let uri = match[2];
    if (/[.,;:!?]$/.test(uri)) uri = uri.slice(0, -1);
    if (uri.endsWith(")") && !uri.includes("(")) uri = uri.slice(0, -1);
    links.push({ kind: "link", start, end: start + uri.length, uri });
  }
  return links;
}

// Mastodon's own mention pattern (app/models/account.rb MENTION_RE), remote form only.
const MASTODON_MENTION_RE =
  /(?<![=/\w])@([a-z0-9_]+(?:[.-]+[a-z0-9_]+)*)@\w+(?:[.-]+\w+)*/gi;

/**
 * Links, mentions and #tags, sorted and without overlaps. Mentions differ per
 * platform: @handle.domain on Bluesky, @user@instance on Mastodon.
 */
export function findEntities(text: string, platform: Platform): Entity[] {
  const entities: Entity[] = findLinks(text);
  if (platform === "bluesky")
    for (const match of text.matchAll(MENTION_RE)) {
      const handle = match[2];
      if (!DOMAIN_RE.test(handle)) continue;
      const start = match.index + match[1].length;
      entities.push({
        kind: "mention",
        start,
        end: start + handle.length + 1,
        handle,
      });
    }
  else
    for (const match of text.matchAll(MASTODON_MENTION_RE))
      entities.push({
        kind: "mention",
        start: match.index,
        end: match.index + match[0].length,
        handle: match[0].slice(1),
      });
  for (const match of text.matchAll(TAG_RE)) {
    const tag = match[2]?.trim().replace(/\p{P}+$/gu, "");
    if (!tag || tag.length > 64) continue;
    const start = match.index + match[1].length;
    entities.push({ kind: "tag", start, end: start + tag.length + 1, tag });
  }
  entities.sort((a, b) => a.start - b.start);
  return entities.filter((e, i) => i === 0 || e.start >= entities[i - 1].end);
}

/** Bluesky's display form of a link: host plus at most 13 characters of path. */
export function shortUrl(uri: string) {
  try {
    const url = new URL(uri);
    const path =
      (url.pathname === "/" ? "" : url.pathname) + url.search + url.hash;
    return url.host + (path.length > 15 ? path.slice(0, 13) + "..." : path);
  } catch {
    return uri;
  }
}

/** The text Bluesky stores and counts: links shortened, the full URL kept in the facet. */
export function blueskyText(text: string) {
  let out = "";
  let last = 0;
  const links: { start: number; end: number; uri: string }[] = [];
  for (const link of findLinks(text)) {
    out += text.slice(last, link.start);
    const display = shortUrl(link.uri);
    links.push({
      start: out.length,
      end: out.length + display.length,
      uri: link.uri,
    });
    out += display;
    last = link.end;
  }
  return { text: out + text.slice(last), links };
}

export const BLUESKY_LIMIT = 300;
const BLUESKY_MAX_BYTES = 3000;

// Mastodon's StatusLengthValidator: every URL counts as a fixed length, a remote
// mention as just its username, and the rest in grapheme clusters.
export function mastodonLength(text: string, urlLength: number) {
  let countable = "";
  let last = 0;
  for (const link of findLinks(text)) {
    countable += text.slice(last, link.start) + "x".repeat(urlLength);
    last = link.end;
  }
  countable += text.slice(last);
  return graphemes(countable.replace(MASTODON_MENTION_RE, "@$1"));
}

/** A line with only `---` separates posts. */
export const splitParts = (text: string) =>
  text.split(/\n?^[ \t]*---[ \t]*$\n?/m);

export type Platform = "bluesky" | "mastodon";

// `[image 3]` places image 3 in a post; it is removed from the text that goes out.
const SHORTCODE_RE = /\[image (\d+)\]/g;

export const shortcode = (n: number) => `[image ${n}]`;

export const shortcodeRanges = (text: string) =>
  [...text.matchAll(SHORTCODE_RE)].map((m) => ({
    start: m.index,
    end: m.index + m[0].length,
    n: Number(m[1]),
  }));

export const imageNumbers = (text: string) => [
  ...new Set(shortcodeRanges(text).map((r) => r.n)),
];

export const stripShortcodes = (text: string) =>
  text
    // A shortcode takes one neighbouring space with it, so words stay one space apart.
    .replace(
      /[ \t]*\[image \d+\]([ \t]*)/g,
      (_, after: string, at: number, all: string) =>
        at === 0 || all[at - 1] === "\n" ? "" : after,
    )
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

export type OutgoingPost = {
  text: string;
  images: number[];
  length: number;
  limit: number;
  fits: boolean;
};

/**
 * What each post sends on `platform`, or null for an empty post (skipped).
 * Numbers (1/3) count toward the limit.
 */
export function buildThread(
  platform: Platform,
  posts: string[],
  {
    numbering,
    maxChars = 500,
    urlLength = 23,
  }: { numbering: boolean; maxChars?: number; urlLength?: number },
): (OutgoingPost | null)[] {
  const limit = platform === "bluesky" ? BLUESKY_LIMIT : maxChars;
  const drafts = posts.map((text) => ({
    text: stripShortcodes(text),
    images: imageNumbers(text),
  }));
  const total = drafts.filter((d) => d.text || d.images.length).length;
  let k = 0;
  return drafts.map((d) => {
    if (!d.text && d.images.length === 0) return null;
    k++;
    const text =
      numbering && total > 1
        ? `${d.text}\n\n${k}/${total}`.trimStart()
        : d.text;
    const stored = blueskyText(text).text;
    const length =
      platform === "bluesky"
        ? graphemes(stored)
        : mastodonLength(text, urlLength);
    const fits =
      length <= limit &&
      (platform !== "bluesky" || byteLength(stored) <= BLUESKY_MAX_BYTES);
    return { text, images: d.images, length, limit, fits };
  });
}
