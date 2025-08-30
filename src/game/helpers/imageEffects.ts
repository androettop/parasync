import { ImageSource } from "excalibur";

export async function applyBlur(
  originalImage: ImageSource,
  blurPct: number = 0.01,
): Promise<ImageSource> {
  // Create a canvas to apply the blur effect
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (ctx) {
    // Configure canvas size according to the original image
    const img = await originalImage.load();
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;

    // Draw the original image on the canvas
    ctx.drawImage(img, 0, 0);

    // Apply blur using CSS filter
    ctx.filter = `blur(${Math.floor(blurPct * img.naturalWidth)}px)`;
    ctx.drawImage(img, 0, 0);

    return ImageSource.fromHtmlCanvasElement(canvas);
  }

  console.warn("Failed to apply blur effect");
  return originalImage;
}
