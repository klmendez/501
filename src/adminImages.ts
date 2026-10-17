export async function optimizedImage(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
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
