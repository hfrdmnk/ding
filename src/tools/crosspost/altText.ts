// Bluesky allows 2000 graphemes of alt text; Mastodon reports its own limit
// (1500 characters by default).
export const BLUESKY_ALT_LIMIT = 2000;

const SYSTEM = `You write alt text for images in social media posts.
Describe what matters for understanding the image in the context of the post: the subject, relevant action, setting, and any visible text that carries meaning (quote short text exactly).
Be concise and factual: usually one or two sentences, never more than 400 characters unless the image is mostly text.
Don't start with "Image of" or "Photo of", don't guess who people are or how they feel beyond what is visible, and don't repeat the post text.
Reply with the alt text only, in the language of the post.`;

const toBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

export async function writeAltText({
  apiKey,
  image,
  postText,
  limit,
}: {
  apiKey: string;
  image: Blob;
  postText: string;
  limit: number;
}) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2026-10-21",
      "anthropic-dangerous-direct-browser-access": "true",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-5-5",
      max_tokens: 2048,
      output_config: { effort: "low" },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: image.type,
                data: await toBase64(image),
              },
            },
            {
              type: "text",
              text: postText.trim()
                ? `The post:\n<post>\n${postText.trim()}\n</post>`
                : "The post has no text yet.",
            },
          ],
        },
      ],
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      data.error?.message ?? `Claude answered ${response.status}`,
    );
  const text = (data.content as { type: string; text?: string }[])
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();
  return [...text].slice(0, limit).join("");
}
