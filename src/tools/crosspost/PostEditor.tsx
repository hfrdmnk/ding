import type { ComponentProps, ReactNode, Ref } from "react";
import { findEntities, shortcodeRanges } from "./text";

type PostEditorProps = Omit<
  ComponentProps<"textarea">,
  "value" | "className"
> & {
  value: string;
  textareaRef: Ref<HTMLTextAreaElement>;
  /** Whether the image behind `[image n]` still needs alt text. */
  needsAlt: (n: number) => boolean;
};

// Shared by the textarea and the mirror behind it, so their text lines up exactly.
const textClass =
  "col-start-1 row-start-1 m-0 w-full p-0 text-lg whitespace-pre-wrap [overflow-wrap:anywhere]";

const chipRing = (color: string) => ({
  backgroundColor: color,
  // A ring instead of padding keeps the chip exactly as wide as its text.
  boxShadow: `0 0 0 3px ${color}`,
});

function marks(text: string) {
  const all = [
    ...findEntities(text, "bluesky").map((e) => ({ ...e, n: 0 })),
    ...findEntities(text, "mastodon")
      .filter((e) => e.kind === "mention")
      .map((e) => ({ ...e, n: 0 })),
    ...shortcodeRanges(text).map((r) => ({ ...r, kind: "image" as const })),
  ].sort((a, b) => a.start - b.start);
  let end = 0;
  return all.filter((mark) => {
    if (mark.start < end) return false;
    end = mark.end;
    return true;
  });
}

/**
 * A post's text as you write it: an invisible textarea over a copy of the text
 * that shows links, mentions, tags and image shortcodes.
 */
export function PostEditor({
  value,
  textareaRef,
  needsAlt,
  ...props
}: PostEditorProps) {
  const out: ReactNode[] = [];
  let last = 0;
  for (const mark of marks(value)) {
    out.push(value.slice(last, mark.start));
    const content = value.slice(mark.start, mark.end);
    out.push(
      mark.kind === "image" ? (
        <span
          key={mark.start}
          className="rounded-sm text-secondary"
          style={chipRing(
            needsAlt(mark.n)
              ? "color-mix(in oklab, var(--orange) 22%, var(--bg))"
              : "color-mix(in oklab, var(--secondary) 15%, var(--bg))",
          )}
        >
          {content}
        </span>
      ) : (
        <span
          key={mark.start}
          className="underline decoration-[color-mix(in_oklab,var(--secondary)_50%,var(--bg))] underline-offset-2"
        >
          {content}
        </span>
      ),
    );
    last = mark.end;
  }
  out.push(value.slice(last));

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)]">
      <div aria-hidden className={`${textClass} text-primary`}>
        {out}
        {/* Gives a trailing empty line its height. */}{" "}
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        rows={1}
        // The caret marks focus in running text, as in any writing app; a ring around each post would be noise.
        className={`${textClass} resize-none overflow-hidden border-0 bg-transparent text-transparent caret-primary outline-transparent selection:text-transparent placeholder:text-[color-mix(in_oklab,var(--secondary)_70%,var(--bg))]`}
        {...props}
      />
    </div>
  );
}
