import { createFileRoute } from "@tanstack/react-router";
import { MediaImagePlus, Sparks, Xmark } from "iconoir-react";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import { useStore } from "../lib/store";
import { BLUESKY_ALT_LIMIT, writeAltText } from "../tools/crosspost/altText";
import * as bluesky from "../tools/crosspost/bluesky";
import { checkConnection, type Check } from "../tools/crosspost/connection";
import { prepareImage } from "../tools/crosspost/images";
import {
  mentionKey,
  mentionQuery,
  renderMentions,
  searchPeople,
} from "../tools/crosspost/mentions";
import * as mastodon from "../tools/crosspost/mastodon";
import { PostEditor } from "../tools/crosspost/PostEditor";
import { discard, isRunning, run, start } from "../tools/crosspost/publish";
import { Ring } from "../tools/crosspost/Ring";
import { Settings } from "../tools/crosspost/Settings";
import {
  accounts,
  draft,
  imageFiles,
  posting,
  preferences,
  type DraftImage,
  type Job,
  type Person,
} from "../tools/crosspost/stores";
import {
  BLUESKY_LIMIT,
  buildThread,
  imageNumbers,
  shortcode,
  splitParts,
  type Platform,
} from "../tools/crosspost/text";
import { Button } from "../ui/Button";
import { ToolShell } from "../ui/ToolShell";
import { Tooltip } from "../ui/Tooltip";

export const Route = createFileRoute("/crosspost")({
  head: () => ({
    meta: [
      { title: "Crosspost · Ding" },
      {
        name: "description",
        content:
          "Write once, post a thread to Bluesky and Mastodon at the same time. Free, local, no accounts.",
      },
    ],
  }),
  component: Crosspost,
});

const PLATFORMS: Platform[] = ["bluesky", "mastodon"];
const NAMES: Record<Platform, string> = {
  bluesky: "Bluesky",
  mastodon: "Mastodon",
};
const COLORS: Record<Platform, string> = {
  bluesky: "var(--blue)",
  mastodon: "var(--violet)",
};
const MAX_IMAGES = 4;
const line = "color-mix(in oklab, var(--secondary) 20%, var(--bg))";
const subtle = "bg-[color-mix(in_oklab,var(--secondary)_10%,var(--bg))]";
const iconButton =
  "grid size-11 shrink-0 place-items-center rounded-full text-secondary hover:text-primary active:scale-[0.96]";

const without = <T,>(record: Record<string, T>, key: string) => {
  const next = { ...record };
  delete next[key];
  return next;
};

// Object URLs for image thumbnails, kept for the page's lifetime.
const imageUrls = new Map<string, string>();

function useImageUrls(ids: string[]) {
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const key = ids.join(",");
  useEffect(() => {
    let cancelled = false;
    for (const id of key.split(",")) {
      if (!id || imageUrls.has(id)) continue;
      void imageFiles.get(id).then((file) => {
        if (!file || imageUrls.has(id)) return;
        imageUrls.set(id, URL.createObjectURL(file));
        if (!cancelled) rerender();
      });
    }
    return () => {
      cancelled = true;
    };
  }, [key]);
  return imageUrls;
}

// insertText keeps the edit on the undo stack; setRangeText is the fallback.
function replaceRange(
  el: HTMLTextAreaElement,
  start: number,
  end: number,
  value: string,
  onFallback: (text: string) => void,
) {
  el.focus();
  el.setSelectionRange(start, end);
  if (document.execCommand("insertText", false, value)) return;
  el.setRangeText(value, start, end, "end");
  onFallback(el.value);
}

const noSubscribe = () => () => {};
const useIsMac = () =>
  useSyncExternalStore(
    noSubscribe,
    () => /Mac|iPhone|iPad/.test(navigator.platform),
    () => false,
  );

/** Text offset under the pointer in `el`, else its caret. */
function offsetAt(el: HTMLTextAreaElement, x: number, y: number) {
  const position = document.caretPositionFromPoint?.(x, y);
  if (position?.offsetNode === el) return position.offset;
  return el.selectionStart ?? el.value.length;
}

function Crosspost() {
  const [{ posts, images, mentions }, setDraft] = useStore(draft);
  const [prefs, setPrefs] = useStore(preferences);
  const [account] = useStore(accounts);
  const [{ job, posted }, setPosting] = useStore(posting);
  const [checks, setChecks] = useState<Partial<Record<Platform, Check>>>({});
  const [altState, setAltState] = useState<
    Record<string, "writing" | { error: string }>
  >({});
  const [notice, setNotice] = useState<string | null>(null);
  const [focus, setFocus] = useState({ post: 0, caret: 0 });
  const [results, setResults] = useState<{ query: string; people: Person[] }>({
    query: "",
    people: [],
  });
  const [highlighted, setHighlighted] = useState(0);
  const [dismissedAt, setDismissedAt] = useState<string | null>(null);
  const textareas = useRef<(HTMLTextAreaElement | null)[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingFocus = useRef<{ post: number; caret: number } | null>(null);
  const urls = useImageUrls(images.map((image) => image.id));
  const shortcut = useIsMac() ? "⌘↵" : "Ctrl+↵";

  // Moves the caret after a split or merge, once the posts have rendered.
  useLayoutEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = null;
    const el = textareas.current[target.post];
    el?.focus();
    el?.setSelectionRange(target.caret, target.caret);
  });

  const connected: Record<Platform, boolean> = {
    bluesky: !!account.bluesky,
    mastodon: !!account.mastodon,
  };
  const active = PLATFORMS.filter((p) => connected[p] && prefs.enabled[p]);
  const altLimit = Math.min(
    BLUESKY_ALT_LIMIT,
    account.mastodon?.altLimit ?? 1500,
  );

  const blueskyId = account.bluesky?.did;
  const mastodonId =
    account.mastodon && account.mastodon.instance + account.mastodon.token;
  useEffect(() => {
    if (!blueskyId) return;
    void checkConnection("bluesky").then((result) =>
      setChecks((prev) => ({ ...prev, bluesky: result })),
    );
  }, [blueskyId]);
  useEffect(() => {
    if (!mastodonId) return;
    void checkConnection("mastodon").then((result) =>
      setChecks((prev) => ({ ...prev, mastodon: result })),
    );
  }, [mastodonId]);

  // Sign-ins come back here: Mastodon with ?code&state, Bluesky with #code&state.
  useEffect(() => {
    const failed = (name: string) => (error: unknown) =>
      setNotice(
        `Couldn't connect ${name}: ${error instanceof Error ? error.message : String(error)}`,
      );
    const params = new URLSearchParams(location.search);
    if (params.has("state")) {
      history.replaceState(
        history.state,
        "",
        location.pathname + location.hash,
      );
      void mastodon.finishSignIn(params).then((mastodon) => {
        if (mastodon) accounts.set((prev) => ({ ...prev, mastodon }));
      }, failed("Mastodon"));
    }
    if (/[#&](state|code|error)=/.test(location.hash))
      void bluesky.init().then((bluesky) => {
        if (bluesky) accounts.set((prev) => ({ ...prev, bluesky }));
      }, failed("Bluesky"));
  }, []);

  useEffect(() => {
    // A thread that was posting when its tab closed can continue from where it
    // stopped. One still posting in another tab holds its lock and is left alone.
    for (const platform of PLATFORMS)
      if (posting.get().job?.platforms[platform]?.status === "posting")
        void isRunning(platform).then((running) => {
          if (running) return;
          setPosting((prev) => {
            const state = prev.job?.platforms[platform];
            if (!prev.job || !state) return prev;
            return {
              ...prev,
              job: {
                ...prev.job,
                platforms: {
                  ...prev.job.platforms,
                  [platform]: {
                    ...state,
                    status: "failed",
                    error: "Interrupted. Retry to continue where it stopped.",
                  },
                },
              },
            };
          });
        });
    // Files of images that are no longer in the draft.
    void imageFiles.keys().then((keys) => {
      const kept = new Set(draft.get().images.map((image) => image.id));
      for (const key of keys) if (!kept.has(key)) void imageFiles.delete(key);
    });
  }, [setPosting]);

  const imageByN = useMemo(
    () => new Map(images.map((image) => [image.n, image])),
    [images],
  );
  // Images per post, in shortcode order; a shortcode without an image is ignored.
  const postImages = posts.map((post) =>
    imageNumbers(post).flatMap((n) => imageByN.get(n) ?? []),
  );

  const threads = useMemo(() => {
    const options = { numbering: prefs.numbering };
    return {
      bluesky: buildThread(
        "bluesky",
        posts.map((p) => renderMentions(p, mentions, "bluesky")),
        options,
      ),
      mastodon: buildThread(
        "mastodon",
        posts.map((p) => renderMentions(p, mentions, "mastodon")),
        {
          ...options,
          maxChars: account.mastodon?.maxChars,
          urlLength: account.mastodon?.urlLength,
        },
      ),
    };
  }, [posts, mentions, prefs.numbering, account.mastodon]);

  const empty = posts.every((post) => !post.trim());
  const blocker = (() => {
    if (!connected.bluesky && !connected.mastodon)
      return "Connect Bluesky or Mastodon in settings to post.";
    if (active.length === 0) return "Turn on Bluesky or Mastodon to post.";
    if (empty) return "";
    for (const platform of active)
      if (checks[platform]?.state === "error")
        return `Can't connect to ${NAMES[platform]}: ${checks[platform]?.message}`;
    const full = postImages.findIndex((list) => list.length > MAX_IMAGES);
    if (full >= 0)
      return `Post ${full + 1} has more than ${MAX_IMAGES} images.`;
    for (const platform of active) {
      const over = threads[platform].findIndex((p) => p && !p.fits);
      if (over >= 0)
        return `Post ${over + 1} is too long for ${NAMES[platform]}. Shorten it or press Enter twice to split it.`;
    }
    const used = postImages.flat();
    if (used.some((image) => altState[image.id] === "writing"))
      return "Writing alt text…";
    const missing = used.filter((image) => !image.alt.trim()).length;
    if (missing)
      return missing === 1
        ? "Add alt text to the image to post."
        : `Add alt text to ${missing} images to post.`;
    return null;
  })();

  const post = () => {
    if (job || blocker !== null) return;
    const newJob: Job = {
      images: Object.fromEntries(
        images.map(({ id, alt, width, height }) => [
          id,
          { alt: alt.trim(), width, height },
        ]),
      ),
      mentions,
      platforms: Object.fromEntries(
        active.map((platform) => {
          const outgoing = threads[platform].flatMap((p, i) =>
            p
              ? [
                  {
                    post: i,
                    text: p.text,
                    images: p.images.flatMap((n) => imageByN.get(n)?.id ?? []),
                  },
                ]
              : [],
          );
          const none = outgoing.map(() => null);
          return [
            platform,
            {
              posts: outgoing,
              sent: none,
              keys: none,
              attemptedAt: none,
              status: "posting" as const,
            },
          ];
        }),
      ),
    };
    start(newJob);
  };

  const failed = PLATFORMS.filter(
    (p) => job?.platforms[p]?.status === "failed",
  );
  const retry = () => {
    for (const platform of failed) void run(platform);
  };

  const replacePosts = (
    from: number,
    count: number,
    next: string[],
    caret?: { post: number; caret: number },
  ) => {
    setDraft((prev) => {
      const list = [...prev.posts];
      list.splice(from, count, ...next);
      return { ...prev, posts: list.length ? list : [""] };
    });
    if (caret) pendingFocus.current = caret;
    if (posted) setPosting((prev) => ({ ...prev, posted: null }));
    setNotice(null);
  };

  // A `---` line, typed or pasted, splits the post there.
  const setPost = (i: number, value: string) => {
    const parts = splitParts(value);
    replacePosts(
      i,
      1,
      parts,
      parts.length > 1 ? { post: i + parts.length - 1, caret: 0 } : undefined,
    );
  };

  // Mention autocomplete for the @word before the caret.
  const query = job ? null : mentionQuery(posts[focus.post] ?? "", focus.caret);
  const queryId = query && `${focus.post}:${query.start}`;
  const queryText = query?.query;
  const suggestions = results.query === queryText ? results.people : [];
  const searchMastodon = connected.mastodon;
  const open = !!query && dismissedAt !== queryId && suggestions.length > 0;
  useEffect(() => {
    if (!queryText) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void searchPeople(queryText, {
        bluesky: true,
        mastodon: searchMastodon,
      }).then((people) => {
        if (cancelled) return;
        setResults({ query: queryText, people });
        setHighlighted(0);
      });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [queryText, searchMastodon]);

  const pick = (person: Person) => {
    const el = textareas.current[focus.post];
    if (!el || !query) return;
    const key = mentionKey(person);
    setDraft((prev) => ({
      ...prev,
      mentions: { ...prev.mentions, [key]: person },
    }));
    const i = focus.post;
    replaceRange(el, query.start, focus.caret, `@${key} `, (v) =>
      setPost(i, v),
    );
    setResults({ query: "", people: [] });
  };

  const onKeyDown = (i: number, event: KeyboardEvent<HTMLTextAreaElement>) => {
    const el = event.currentTarget;
    const value = posts[i];
    const at = el.selectionStart;
    const collapsed = at === el.selectionEnd;
    const plain =
      !event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey;
    if (open) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const step = event.key === "ArrowDown" ? 1 : -1;
        setHighlighted(
          (h) => (h + step + suggestions.length) % suggestions.length,
        );
        return;
      }
      if ((event.key === "Enter" || event.key === "Tab") && plain) {
        event.preventDefault();
        pick(suggestions[highlighted]);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setDismissedAt(queryId);
        return;
      }
    }
    if (event.nativeEvent.isComposing || !collapsed || !plain) return;
    // Enter on an empty line starts the next post with the text after the caret.
    if (
      event.key === "Enter" &&
      value[at - 1] === "\n" &&
      (at === value.length || value[at] === "\n")
    ) {
      event.preventDefault();
      replacePosts(
        i,
        1,
        [value.slice(0, at - 1), value.slice(at).replace(/^\n/, "")],
        { post: i + 1, caret: 0 },
      );
      return;
    }
    // Backspace at the start of a post joins it to the one before.
    if (event.key === "Backspace" && at === 0 && i > 0) {
      event.preventDefault();
      const before = posts[i - 1];
      replacePosts(i - 1, 2, [before + (before && value ? "\n" : "") + value], {
        post: i - 1,
        caret: before.length,
      });
      return;
    }
    // Arrows move between posts at their edges, like one long text.
    if (event.key === "ArrowUp" && at === 0 && i > 0) {
      event.preventDefault();
      pendingFocus.current = { post: i - 1, caret: posts[i - 1].length };
      setFocus(pendingFocus.current);
    } else if (
      event.key === "ArrowDown" &&
      at === value.length &&
      i < posts.length - 1
    ) {
      event.preventDefault();
      pendingFocus.current = { post: i + 1, caret: 0 };
      setFocus(pendingFocus.current);
    }
  };

  const describe = async (image: DraftImage, file: Blob) => {
    const apiKey = accounts.get().claudeKey;
    if (!apiKey) return;
    setAltState((prev) => ({ ...prev, [image.id]: "writing" }));
    try {
      const all = draft.get().posts;
      const alt = await writeAltText({
        apiKey,
        image: file,
        postText:
          all.find((p) => imageNumbers(p).includes(image.n)) ?? all.join("\n"),
        limit: altLimit,
      });
      setDraft((prev) => ({
        ...prev,
        images: prev.images.map((i) =>
          i.id === image.id && !i.alt.trim() ? { ...i, alt } : i,
        ),
      }));
      setAltState((prev) => without(prev, image.id));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setAltState((prev) => ({ ...prev, [image.id]: { error: message } }));
    }
  };

  const rewrite = async (image: DraftImage) => {
    const file = await imageFiles.get(image.id);
    if (!file) return;
    setDraft((prev) => ({
      ...prev,
      images: prev.images.map((i) =>
        i.id === image.id ? { ...i, alt: "" } : i,
      ),
    }));
    await describe({ ...image, alt: "" }, file);
  };

  /** Adds images to post `i` at `offset`, each as an `[image n]` shortcode. */
  const addFiles = async (files: File[], i: number, offset: number) => {
    const pictures = files.filter((file) => file.type.startsWith("image/"));
    if (pictures.length === 0) return;
    const room = MAX_IMAGES - postImages[i].length;
    setNotice(
      pictures.length > room
        ? `A post holds up to ${MAX_IMAGES} images. Add more to the next post.`
        : null,
    );
    let at = offset;
    for (const picture of pictures.slice(0, Math.max(0, room))) {
      try {
        const { file, width, height } = await prepareImage(picture);
        const n =
          Math.max(0, ...draft.get().images.map((image) => image.n)) + 1;
        const image: DraftImage = {
          id: crypto.randomUUID(),
          n,
          alt: "",
          width,
          height,
        };
        await imageFiles.put(image.id, file);
        imageUrls.set(image.id, URL.createObjectURL(file));
        setDraft((prev) => {
          const text = prev.posts[i] ?? "";
          const before = text.slice(0, at);
          const after = text.slice(at);
          const code =
            (before && !/\s$/.test(before) ? " " : "") +
            shortcode(n) +
            (after && !/^\s/.test(after) ? " " : "");
          at = before.length + code.length;
          const list = [...prev.posts];
          list[i] = before + code + after;
          return { ...prev, posts: list, images: [...prev.images, image] };
        });
        pendingFocus.current = { post: i, caret: at };
        void describe(image, file);
      } catch {
        setNotice(
          `Couldn't read ${picture.name || "the image"}. Try a JPEG or PNG.`,
        );
      }
    }
  };

  const removeImage = (image: DraftImage) => {
    const code = shortcode(image.n);
    setDraft((prev) => ({
      ...prev,
      posts: prev.posts.map((p) =>
        p.split(code).join("").replace(/ {2,}/g, " "),
      ),
      images: prev.images.filter((i) => i.id !== image.id),
    }));
    void imageFiles.delete(image.id);
    const url = imageUrls.get(image.id);
    if (url) URL.revokeObjectURL(url);
    imageUrls.delete(image.id);
    setAltState((prev) => without(prev, image.id));
  };

  const onPaste = (i: number, event: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = [...event.clipboardData.files];
    if (files.length === 0) return;
    // Office apps also put a picture of the copied text on the clipboard; paste
    // the text. A copied file brings only its name as text, so it still pastes as an image.
    const text = event.clipboardData.getData("text/plain").trim();
    if (text && !files.some((file) => text.includes(file.name))) return;
    event.preventDefault();
    void addFiles(files, i, event.currentTarget.selectionStart);
  };

  // A drop lands at the pointer in the post under it, else at the end of the last post.
  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    if (job) return;
    const target = (event.target as Element).closest("[data-post]");
    const i = target
      ? Number(target.getAttribute("data-post"))
      : posts.length - 1;
    const el = textareas.current[i];
    const offset = el
      ? target
        ? offsetAt(el, event.clientX, event.clientY)
        : el.value.length
      : 0;
    void addFiles([...event.dataTransfer.files], i, offset);
  };

  // Like the Bluesky composer: a ring that fills toward the limit, and past it a
  // red pie that fills with the overshoot. The count shows on hover.
  const counter = (platform: Platform, i: number) => {
    const name = NAMES[platform];
    const color = COLORS[platform];
    let ring;
    let status: string;
    let dim = false;
    const state = job?.platforms[platform];
    if (job) {
      const j = state?.posts.findIndex((p) => p.post === i) ?? -1;
      const next = state?.sent.findIndex((sent) => !sent);
      if (!state || j < 0) {
        dim = true;
        status = "Not posted";
        ring = <Ring color={color} progress={0} />;
      } else if (state.sent[j]) {
        status = "Posted";
        ring = <Ring color={color} progress={1} pie />;
      } else if (j === next && state.status === "failed") {
        status = "Failed";
        ring = <Ring color="var(--red)" progress={1} pie />;
      } else if (j === next) {
        status = "Posting";
        ring = <Ring color={color} progress={0.3} spin />;
      } else {
        status = "Waiting";
        ring = <Ring color={color} progress={0} />;
      }
    } else {
      const out = threads[platform][i];
      const limit =
        out?.limit ??
        (platform === "bluesky"
          ? BLUESKY_LIMIT
          : (account.mastodon?.maxChars ?? 500));
      const length = out?.length ?? 0;
      const over = !!out && !out.fits;
      dim = !active.includes(platform);
      status = over
        ? `${length - limit} characters over`
        : `${limit - length} characters left`;
      ring = over ? (
        <Ring color="var(--red)" progress={(length - limit) / limit} pie />
      ) : (
        <Ring color={color} progress={length / limit} />
      );
    }
    return (
      <Tooltip key={platform} content={`${name}: ${status}`}>
        <span
          className={`flex transition-opacity duration-150 ${dim ? "opacity-30" : ""}`}
        >
          <span className="sr-only">
            {name}: {status}
          </span>
          {ring}
        </span>
      </Tooltip>
    );
  };

  const message = job
    ? PLATFORMS.flatMap((p) =>
        job.platforms[p]?.error
          ? [`${NAMES[p]}: ${job.platforms[p]?.error}`]
          : [],
      ).join("\n")
    : (notice ?? (blocker || null));

  return (
    <ToolShell title="Crosspost" wide settings={<Settings checks={checks} />}>
      <div
        className="flex flex-1 flex-col pb-40"
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            if (failed.length) retry();
            else post();
          }
        }}
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes("Files"))
            event.preventDefault();
        }}
        onDrop={onDrop}
      >
        {posted && !job && (
          <p role="status" className="pb-4 text-sm text-secondary">
            Posted.{" "}
            {PLATFORMS.filter((p) => posted[p]).map((p, i) => (
              <span key={p}>
                {i > 0 && " · "}
                <a
                  href={posted[p]}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-primary underline decoration-[color-mix(in_oklab,var(--secondary)_45%,var(--bg))] underline-offset-2 hover:text-orange"
                >
                  Open on {NAMES[p]}
                </a>
              </span>
            ))}
          </p>
        )}

        <ol className="flex flex-col">
          {posts.map((value, i) => (
            <li
              key={i}
              data-post={i}
              className="flex flex-col border-t py-5 first:border-t-0 first:pt-8"
              style={{ borderColor: line }}
            >
              <div inert={!!job} className="flex flex-col">
                <PostEditor
                  value={value}
                  textareaRef={(el) => {
                    textareas.current[i] = el;
                  }}
                  needsAlt={(n) => !imageByN.get(n)?.alt.trim()}
                  aria-label={posts.length > 1 ? `Post ${i + 1}` : "Post"}
                  placeholder={
                    i === 0
                      ? "Write something. Press Enter twice to start the next post."
                      : "Next post"
                  }
                  autoFocus={i === 0}
                  onChange={(event) => {
                    setPost(i, event.target.value);
                    setFocus({ post: i, caret: event.target.selectionStart });
                  }}
                  onSelect={(event) =>
                    setFocus({
                      post: i,
                      caret: event.currentTarget.selectionStart,
                    })
                  }
                  onFocus={(event) =>
                    setFocus({
                      post: i,
                      caret: event.currentTarget.selectionStart,
                    })
                  }
                  onKeyDown={(event) => onKeyDown(i, event)}
                  onPaste={(event) => onPaste(i, event)}
                  role="combobox"
                  aria-expanded={open && focus.post === i}
                  aria-controls="mention-suggestions"
                  aria-autocomplete="list"
                  aria-activedescendant={
                    open && focus.post === i
                      ? `mention-${highlighted}`
                      : undefined
                  }
                />
                {open && focus.post === i && (
                  <ul
                    id="mention-suggestions"
                    role="listbox"
                    aria-label="People"
                    className="mt-3 flex flex-col"
                  >
                    {suggestions.map((person, k) => (
                      <li
                        key={mentionKey(person)}
                        id={`mention-${k}`}
                        role="option"
                        aria-selected={k === highlighted}
                        onPointerDown={(event) => event.preventDefault()}
                        onClick={() => pick(person)}
                        onPointerEnter={() => setHighlighted(k)}
                        className={`-mx-2 flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 ${
                          k === highlighted ? subtle : ""
                        }`}
                      >
                        {person.avatar ? (
                          <img
                            src={person.avatar}
                            alt=""
                            width={28}
                            height={28}
                            className="size-7 shrink-0 rounded-full object-cover"
                          />
                        ) : (
                          <span
                            className={`size-7 shrink-0 rounded-full ${subtle}`}
                          />
                        )}
                        <span className="min-w-0">
                          <span className="block truncate font-medium">
                            {person.name}
                          </span>
                          <span className="block truncate text-xs text-secondary">
                            {[
                              person.bluesky && `@${person.bluesky.handle}`,
                              person.mastodon && `@${person.mastodon.acct}`,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                {postImages[i].length > 0 && (
                  <ul className="mt-4 flex flex-col gap-3">
                    {postImages[i].map((image) => {
                      const state = altState[image.id];
                      return (
                        <li key={image.id} className="flex items-start gap-3">
                          <img
                            src={urls.get(image.id)}
                            alt=""
                            width={image.width}
                            height={image.height}
                            className={`size-16 shrink-0 rounded-lg object-cover ${subtle}`}
                          />
                          <label className="flex min-w-0 flex-1 flex-col">
                            <span className="text-xs text-secondary">
                              {shortcode(image.n)} alt text
                            </span>
                            <textarea
                              value={image.alt}
                              maxLength={altLimit}
                              readOnly={state === "writing"}
                              placeholder={
                                state === "writing"
                                  ? "Writing alt text…"
                                  : "Describe the image for people who can't see it"
                              }
                              onChange={(event) =>
                                setDraft((prev) => ({
                                  ...prev,
                                  images: prev.images.map((im) =>
                                    im.id === image.id
                                      ? { ...im, alt: event.target.value }
                                      : im,
                                  ),
                                }))
                              }
                              className="w-full resize-none bg-transparent text-base outline-transparent [field-sizing:content] placeholder:text-[color-mix(in_oklab,var(--orange)_70%,var(--secondary))]"
                            />
                            {typeof state === "object" && (
                              <span className="text-xs text-secondary">
                                Couldn't write alt text: {state.error}
                              </span>
                            )}
                          </label>
                          <div className="-mt-2 -mr-2.5 flex shrink-0">
                            {account.claudeKey && state !== "writing" && (
                              <button
                                type="button"
                                aria-label="Rewrite alt text with Claude"
                                title="Rewrite alt text with Claude"
                                onClick={() => void rewrite(image)}
                                className={iconButton}
                              >
                                <Sparks width={18} height={18} />
                              </button>
                            )}
                            <button
                              type="button"
                              aria-label="Remove image"
                              onClick={() => removeImage(image)}
                              className={iconButton}
                            >
                              <Xmark width={18} height={18} />
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="mt-3 flex justify-end gap-3">
                {PLATFORMS.map((platform) => counter(platform, i))}
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 flex flex-col items-center gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {message && (
          <p
            role={job ? "alert" : undefined}
            aria-live="polite"
            className="pointer-events-auto max-w-md rounded-xl bg-bg px-3 py-1 text-center text-sm text-balance whitespace-pre-line text-secondary"
          >
            {message}
          </p>
        )}
        <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-bg p-1 ring-1 ring-[color-mix(in_oklab,var(--secondary)_25%,var(--bg))]">
          {!job && (
            <>
              <button
                type="button"
                aria-label="Add images"
                title="Add images"
                onClick={() => fileInputRef.current?.click()}
                className={iconButton}
              >
                <MediaImagePlus width={20} height={20} />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(event) => {
                  const i = Math.min(focus.post, posts.length - 1);
                  void addFiles(
                    [...(event.target.files ?? [])],
                    i,
                    textareas.current[i]?.selectionStart ?? posts[i].length,
                  );
                  event.target.value = "";
                }}
              />
              {PLATFORMS.filter((p) => connected[p]).map((platform) => {
                const on = prefs.enabled[platform];
                return (
                  <button
                    key={platform}
                    type="button"
                    aria-pressed={on}
                    aria-label={`Post to ${NAMES[platform]}`}
                    title={`${NAMES[platform]} ${on ? "on" : "off"}`}
                    onClick={() =>
                      setPrefs((prev) => ({
                        ...prev,
                        enabled: { ...prev.enabled, [platform]: !on },
                      }))
                    }
                    className="grid size-11 shrink-0 place-items-center rounded-full active:scale-[0.96]"
                  >
                    <span
                      className="size-3 rounded-full transition-colors duration-150"
                      style={{
                        backgroundColor: on ? COLORS[platform] : "transparent",
                        boxShadow: `inset 0 0 0 1.5px ${COLORS[platform]}`,
                      }}
                    />
                  </button>
                );
              })}
            </>
          )}
          {job && failed.length > 0 ? (
            <>
              <Button variant="ghost" onClick={discard}>
                Discard
              </Button>
              <Button onClick={retry}>Retry</Button>
            </>
          ) : job ? (
            <Button disabled>Posting…</Button>
          ) : (
            <Button
              onClick={post}
              disabled={blocker !== null}
              aria-keyshortcuts="Meta+Enter Control+Enter"
            >
              Post
              <span className="text-sm font-normal opacity-60">{shortcut}</span>
            </Button>
          )}
        </div>
      </div>
    </ToolShell>
  );
}
