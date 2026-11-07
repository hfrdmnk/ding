import * as bluesky from "./bluesky";
import * as mastodon from "./mastodon";
import type { Person } from "./stores";
import { findEntities, type Platform } from "./text";

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * What a mention of `person` says on `platform`: what was set for it, else
 * their account there, else their name.
 */
export function mentionText(person: Person, platform: Platform) {
  const custom = person.custom?.[platform];
  if (custom !== undefined) return custom;
  const account =
    platform === "bluesky" ? person.bluesky?.handle : person.mastodon?.acct;
  return account ? `@${account}` : person.name;
}

/** The mention the caret is inside of (not at its edge), if any. */
export function mentionAt(text: string, caret: number) {
  const mention = [
    ...findEntities(text, "mastodon"),
    ...findEntities(text, "bluesky"),
  ].find((e) => e.kind === "mention" && e.start < caret && caret < e.end);
  if (!mention) return null;
  const written = text.slice(mention.start, mention.end);
  return { ...mention, written, key: written.slice(1).toLowerCase() };
}

/** The text as it goes out on `platform`, with each picked mention as `mentionText`. */
export function renderMentions(
  text: string,
  mentions: Record<string, Person>,
  platform: Platform,
) {
  const keys = Object.keys(mentions).sort((a, b) => b.length - a.length);
  if (keys.length === 0) return text;
  // Starts like Mastodon's mention pattern, the looser of the two, so every
  // mention the editor marks is replaced.
  const re = new RegExp(
    `(?<![=/\\w])@(${keys.map(escape).join("|")})(?![\\w@-]|\\.\\w)`,
    "gi",
  );
  return text.replace(re, (_, key: string) =>
    mentionText(mentions[key] ?? mentions[key.toLowerCase()], platform),
  );
}

/** The @query being typed just before the caret, if any. */
export function mentionQuery(text: string, caret: number) {
  const match = text
    .slice(0, caret)
    .match(/(?:^|[\s(])@([a-z0-9_][\w.-]*(?:@[\w.-]*)?)$/i);
  if (!match) return null;
  return { start: caret - match[1].length - 1, query: match[1] };
}

const normalize = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]/gu, "")
    .toLowerCase();

/**
 * Suggestions from both platforms. People with the same name, or a Mastodon
 * username equal to the first part of their Bluesky handle, are paired.
 */
export async function searchPeople(
  query: string,
  on: { bluesky: boolean; mastodon: boolean },
): Promise<Person[]> {
  const [sky, masto] = await Promise.all([
    on.bluesky && !query.includes("@")
      ? bluesky.searchPeople(query).catch(() => [])
      : [],
    on.mastodon ? mastodon.searchPeople(query).catch(() => []) : [],
  ]);
  const unpaired = [...masto];
  const pairs = new Map<string, (typeof masto)[number]>();
  // Same name first, so a username match can't take someone's namesake.
  const tests = [
    (actor: (typeof sky)[number], account: (typeof masto)[number]) =>
      !!actor.displayName &&
      normalize(actor.displayName) !== "" &&
      normalize(actor.displayName) === normalize(account.display_name),
    (actor: (typeof sky)[number], account: (typeof masto)[number]) =>
      account.username.toLowerCase() === actor.handle.split(".")[0],
  ];
  for (const test of tests)
    for (const actor of sky) {
      if (pairs.has(actor.did)) continue;
      const i = unpaired.findIndex((account) => test(actor, account));
      if (i >= 0) pairs.set(actor.did, unpaired.splice(i, 1)[0]);
    }
  const people: Person[] = sky.map((actor) => {
    const pair = pairs.get(actor.did);
    return {
      name: actor.displayName?.trim() || actor.handle,
      avatar: actor.avatar,
      bluesky: { handle: actor.handle, did: actor.did },
      ...(pair && { mastodon: { acct: pair.acct } }),
    };
  });
  for (const account of unpaired)
    people.push({
      name: account.display_name.trim() || account.username,
      avatar: account.avatar,
      mastodon: { acct: account.acct },
    });
  return people.slice(0, 8);
}

/** What gets typed for a person: their Bluesky handle, else their Mastodon address. */
export const mentionKey = (person: Person) =>
  (
    person.bluesky?.handle ??
    person.mastodon?.acct ??
    person.name
  ).toLowerCase();
