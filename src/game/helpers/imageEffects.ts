import { ImageSource } from "excalibur";

export async function applyBlur(
  originalImage: ImageSource,
  blurPct: number = 0.01
): Promise<ImageSource> {
  // Crear un canvas para aplicar el efecto de desenfoque
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (ctx) {
    // Configurar el tamaño del canvas según la imagen original
    const img = await originalImage.load();
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;

    // Dibujar la imagen original en el canvas
    ctx.drawImage(img, 0, 0);

    // Aplicar desenfoque usando CSS filter
    ctx.filter = `blur(${Math.floor(blurPct * img.naturalWidth)}px)`;
    ctx.drawImage(img, 0, 0);

    return ImageSource.fromHtmlCanvasElement(canvas);
  }

  console.warn("Failed to apply blur effect");
  return originalImage;
}
