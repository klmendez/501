import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { hasWhiteBackground, optimizedCatalogImage, whiteBackgroundScore } from "./catalog-image.mjs";
import { curateCatalog } from "../../scripts/catalog-curation.mjs";

const photo = (name) => readFile(new URL(`../../public/productos-501/${name}`, import.meta.url));
const shopPhoto = () => sharp({ create: { width: 400, height: 600, channels: 3, background: { r: 145, g: 125, b: 110 } } }).webp().toBuffer();

test("distingue la portada blanca de una foto del almacén", async () => {
  const white = await photo("001-marca-por-confirmar-negro-modelo.webp");
  const shop = await shopPhoto();
  assert.equal(hasWhiteBackground(await whiteBackgroundScore(white)), true);
  assert.equal(hasWhiteBackground(await whiteBackgroundScore(shop)), false);
  const reduced = await optimizedCatalogImage(white);
  const dimensions = await sharp(reduced).metadata();
  assert.equal(dimensions.width, 800);
  assert.equal(dimensions.height, 1200);
  assert.ok(reduced.length < white.length);
});

test("conserva una foto blanca y una sola referencia por prenda repetida", async () => {
  const base = { name: "Jean azul", brand: "Levi's", category: "Jeans", gender: "Hombre", colors: ["Azul"], description: "La portada muestra una vista digital sobre modelo; revisa las fotos reales de la prenda. Tallas por WhatsApp.", badge: "Vista en modelo" };
  const first = "/productos-501/001-marca-por-confirmar-negro-modelo.webp";
  const second = "/productos-501/002-marca-por-confirmar-azul-oscuro-modelo.webp";
  const shop = "/shop.webp";
  const result = await curateCatalog([
    { ...base, reference: "A", image: first, images: [first, shop] },
    { ...base, reference: "B", image: second, images: [second] },
    { ...base, reference: "C", name: "Otro jean", image: shop, images: [shop] },
  ], async (url) => ({ bytes: url === shop ? await shopPhoto() : await readFile(new URL(`../../public${url}`, import.meta.url)) }));
  assert.deepEqual(result.products.map((item) => item.reference), ["B"]);
  assert.deepEqual(result.products[0].images, [second]);
  assert.equal(result.products[0].badge, undefined);
  assert.equal(result.products[0].description, "Tallas por WhatsApp.");
  assert.deepEqual(result.excludedBackground, ["C"]);
  assert.deepEqual(result.excludedDuplicates, ["A"]);
});
