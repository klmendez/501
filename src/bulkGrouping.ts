export type ImageFingerprint = {
  hash: string;
  color: [number, number, number];
  filenameKey: string;
};

export type UploadPhoto = {
  id: string;
  file: File;
  preview: string;
  fingerprint: ImageFingerprint;
};

const viewWords = /(?:^|[\s_-])(frente|frontal|front|espalda|atras|atrás|back|lado|lateral|detalle|detail|closeup|foto|photo|img|imagen|vista|view|[1-9])(?:$|[\s_-])/gi;

export function filenameKey(filename: string) {
  const stem = filename.replace(/\.[^.]+$/, "").toLowerCase();
  const withoutViews = stem.replace(viewWords, " ").replace(/(?:[\s_-]0?[1-9])$/, "").replace(/[\s_-]+/g, " ").trim();
  const generic = new Set(["jean", "jeans", "camisa", "chaqueta", "conjunto", "producto", "foto", "image"]);
  return withoutViews.length >= 4 && /[a-záéíóúñ]/i.test(withoutViews) && !generic.has(withoutViews) ? withoutViews : "";
}

export function hashDistance(a: string, b: string) {
  let count = 0;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) count += 1;
  return count;
}

export function visuallySimilar(a: ImageFingerprint, b: ImageFingerprint) {
  if (a.filenameKey && a.filenameKey === b.filenameKey) return true;
  const colorDistance = Math.hypot(...a.color.map((value, index) => value - b.color[index]));
  return hashDistance(a.hash, b.hash) <= 5 && colorDistance <= 45;
}

export async function fingerprintImage(file: File): Promise<ImageFingerprint> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 9;
    canvas.height = 8;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("No se pudo analizar la imagen.");
    context.drawImage(image, 0, 0, 9, 8);
    const pixels = context.getImageData(0, 0, 9, 8).data;
    const gray: number[] = [];
    const totals = [0, 0, 0];
    for (let i = 0; i < pixels.length; i += 4) {
      gray.push(pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114);
      for (let channel = 0; channel < 3; channel += 1) totals[channel] += pixels[i + channel];
    }
    let hash = "";
    for (let row = 0; row < 8; row += 1) {
      for (let col = 0; col < 8; col += 1) hash += gray[row * 9 + col] > gray[row * 9 + col + 1] ? "1" : "0";
    }
    return {
      hash,
      color: totals.map((value) => Math.round(value / 72)) as [number, number, number],
      filenameKey: filenameKey(file.name),
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function suggestPhotoGroups(photos: UploadPhoto[]) {
  const groups: UploadPhoto[][] = [];
  for (const photo of photos) {
    const group = groups.find((candidate) => candidate.some((other) => visuallySimilar(photo.fingerprint, other.fingerprint)));
    if (group) group.push(photo);
    else groups.push([photo]);
  }
  return groups;
}
