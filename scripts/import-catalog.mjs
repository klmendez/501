import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const source = process.argv[2];
if (!source) {
  console.error("Uso: npm run import:catalog -- ruta/al/catalogo-501.json");
  process.exit(1);
}

const root = process.cwd();
const publicDir = path.join(root, "public");
const catalogPath = path.join(publicDir, "catalog-products.json");
const uploadsDir = path.join(publicDir, "uploads");
const input = JSON.parse((await readFile(path.resolve(source), "utf8")).replace(/^\uFEFF/, ""));
if (input.version !== 1 || !Array.isArray(input.products)) throw new Error("Archivo de catálogo no válido.");

const catalog = JSON.parse((await readFile(catalogPath, "utf8")).replace(/^\uFEFF/, ""));
const existingByReference = new Map(catalog.map((item) => [item.reference, item]));
let nextId = Math.max(8, ...catalog.map((item) => item.id)) + 1;
const seen = new Set();
const prepared = [];
const imagesToWrite = [];

for (const item of input.products) {
  if (typeof item.name !== "string" || !item.name.trim() || typeof item.reference !== "string" || !item.reference.trim() || !Array.isArray(item.images) || !item.images.length) {
    throw new Error("Cada producto debe tener nombre, referencia y fotos.");
  }
  const reference = item.reference.trim();
  if (seen.has(reference)) throw new Error(`Referencia repetida: ${reference}`);
  seen.add(reference);
  const safeReference = reference.replace(/[^a-zA-Z0-9_-]/g, "-");
  const images = item.images.map((photo, index) => {
    const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(photo.data);
    if (!match) throw new Error(`Imagen no válida en ${reference}`);
    const extension = match[1] === "image/jpeg" ? "jpg" : match[1].split("/")[1];
    const name = `${safeReference}-${index + 1}.${extension}`;
    imagesToWrite.push({ name, data: Buffer.from(match[2], "base64") });
    return `/uploads/${name}`;
  });
  const previous = existingByReference.get(reference);
  prepared.push({
    id: previous?.id ?? nextId++,
    name: item.name.trim(),
    reference,
    brand: typeof item.brand === "string" && item.brand.trim() ? item.brand.trim() : "501",
    category: item.category,
    gender: item.gender,
    image: images[0],
    images,
    minimum: Math.max(1, Number(item.minimum) || 1),
    sizes: Array.isArray(item.sizes) && item.sizes.length ? item.sizes : ["Única"],
    colors: Array.isArray(item.colors) && item.colors.length ? item.colors : ["Por confirmar"],
    description: typeof item.description === "string" ? item.description : "",
  });
}

await mkdir(uploadsDir, { recursive: true });
for (const image of imagesToWrite) await writeFile(path.join(uploadsDir, image.name), image.data);
const updated = [...prepared, ...catalog.filter((item) => !seen.has(item.reference))];
await writeFile(catalogPath, `${JSON.stringify(updated, null, 2)}\n`, "utf8");
console.log(`${prepared.length} productos importados. Publica los cambios de public/ para mostrarlos en la tienda.`);
