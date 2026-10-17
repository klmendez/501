export async function optimizedImage(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const sample = document.createElement("canvas");
    sample.width = 64;
    sample.height = 96;
    const sampleContext = sample.getContext("2d", { willReadFrequently: true });
    if (!sampleContext) throw new Error("No se pudo analizar la imagen.");
    sampleContext.fillStyle = "#fff";
    sampleContext.fillRect(0, 0, 64, 96);
    sampleContext.drawImage(image, 0, 0, 64, 96);
    const pixels = sampleContext.getImageData(0, 0, 64, 96).data;
    let white = 0;
    let sampled = 0;
    for (let y = 0; y < 96; y++) for (let x = 0; x < 64; x++) {
      if (x >= 9 && x < 55 && y >= 12 && y < 84) continue;
      const index = (y * 64 + x) * 4;
      const r = pixels[index];
      const g = pixels[index + 1];
      const b = pixels[index + 2];
      sampled++;
      if (Math.min(r, g, b) >= 228 && Math.max(r, g, b) - Math.min(r, g, b) < 22) white++;
    }
    if (white / sampled < 0.85) throw new Error(`${file.name}: usa una foto con fondo blanco.`);
    const scale = Math.min(1, 1200 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("No se pudo preparar la imagen.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const encode = (quality: number) => new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("No se pudo convertir la foto.")), "image/webp", quality));
    let data = await encode(0.78);
    if (data.size > 3_000_000) data = await encode(0.58);
    if (data.size > 3_000_000) throw new Error(`${file.name} es demasiado grande para publicarla. Usa una imagen más pequeña.`);
    return data;
  } finally {
    URL.revokeObjectURL(url);
  }
}
