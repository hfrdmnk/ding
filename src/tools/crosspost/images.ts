// One file per image that fits both platforms: Bluesky takes up to 1 MB (its
// app shrinks to 2000 px), Mastodon defaults to 16 MB and ~33 MP.
const MAX_BYTES = 1_000_000;
const MAX_SIDE = 2000;
const QUALITIES = [0.9, 0.82, 0.74, 0.66];

const encode = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Couldn't encode the image")),
      type,
      quality,
    ),
  );

/**
 * Re-encodes every image, which also drops its metadata (such as GPS).
 * PNGs (screenshots) stay PNG while they fit; everything else becomes JPEG.
 */
export async function prepareImage(file: Blob) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d")!;
  let scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  try {
    for (;;) {
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const size = { width: canvas.width, height: canvas.height };
      if (file.type === "image/png") {
        context.clearRect(0, 0, size.width, size.height);
        context.drawImage(bitmap, 0, 0, size.width, size.height);
        const png = await encode(canvas, "image/png");
        if (png.size <= MAX_BYTES) return { file: png, ...size };
      }
      // JPEG has no transparency; put transparent areas on white.
      context.fillStyle = "#fff";
      context.fillRect(0, 0, size.width, size.height);
      context.drawImage(bitmap, 0, 0, size.width, size.height);
      for (const quality of QUALITIES) {
        const jpeg = await encode(canvas, "image/jpeg", quality);
        if (jpeg.size <= MAX_BYTES) return { file: jpeg, ...size };
      }
      scale *= 0.8;
    }
  } finally {
    bitmap.close();
  }
}
