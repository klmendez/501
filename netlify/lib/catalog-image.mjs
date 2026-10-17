import sharp from "sharp";

const SAMPLE_WIDTH = 64;
const SAMPLE_HEIGHT = 96;
const WHITE_THRESHOLD = 0.85;

export async function whiteBackgroundScore(input) {
  const { data } = await sharp(input, { failOn: "error" })
    .rotate()
    .flatten({ background: "#ffffff" })
    .resize(SAMPLE_WIDTH, SAMPLE_HEIGHT, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let white = 0;
  let sampled = 0;
  for (let y = 0; y < SAMPLE_HEIGHT; y++) {
    for (let x = 0; x < SAMPLE_WIDTH; x++) {
      if (x >= 9 && x < 55 && y >= 12 && y < 84) continue;
      const index = (y * SAMPLE_WIDTH + x) * 3;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      sampled++;
      if (Math.min(r, g, b) >= 228 && Math.max(r, g, b) - Math.min(r, g, b) < 22) white++;
    }
  }
  return white / sampled;
}

export function hasWhiteBackground(score) {
  return score >= WHITE_THRESHOLD;
}

export async function optimizedCatalogImage(input) {
  return sharp(input, { failOn: "error" })
    .rotate()
    .flatten({ background: "#ffffff" })
    .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 78, effort: 4 })
    .toBuffer();
}
