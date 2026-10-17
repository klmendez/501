import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { curateCatalog } from "./catalog-curation.mjs";

const catalogPath = resolve("public/catalog-products.json");
const original = await readFile(catalogPath, "utf8");
const source = JSON.parse(original);
const { products, excludedBackground, excludedDuplicates } = await curateCatalog(source, async (url) => {
  if (!url.startsWith("/productos-501/")) throw new Error(`Foto no incluida en public: ${url}`);
  return { bytes: await readFile(resolve("public", `.${url}`)) };
});
console.log(`${source.length} productos revisados; ${products.length} con fondo blanco, ${excludedBackground.length} sin fondo blanco, ${excludedDuplicates.length} repetidos.`);
if (process.argv.includes("--apply")) {
  await mkdir(resolve(".visual-check"), { recursive: true });
  await copyFile(catalogPath, resolve(".visual-check/catalog-products-before-curation.json"));
  await writeFile(catalogPath, `${JSON.stringify(products, null, 2)}\n`, "utf8");
  console.log("Catálogo local actualizado. Respaldo en .visual-check/catalog-products-before-curation.json.");
}
