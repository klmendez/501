import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { optimizedCatalogImage } from "../netlify/lib/catalog-image.mjs";
import { curateCatalog } from "./catalog-curation.mjs";

const apply = process.argv.includes("--apply");
const projectUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
const secretKey = process.env.SUPABASE_SECRET_KEY;
const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucket = process.env.R2_BUCKET;
const publicUrl = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");
const sourceUrl = process.env.CATALOG_SOURCE_URL?.replace(/\/$/, "");
const sourcePassword = process.env.CATALOG_ADMIN_PASSWORD;
const publicDir = resolve("public");

if (apply && (!projectUrl || !secretKey)) throw new Error("Configura SUPABASE_URL y SUPABASE_SECRET_KEY antes de usar --apply.");
if (apply && (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicUrl)) throw new Error("Configura R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET y R2_PUBLIC_URL antes de usar --apply.");
if (projectUrl && !/^https:\/\//.test(projectUrl)) throw new Error("SUPABASE_URL debe comenzar por https://.");
if (publicUrl && !/^https:\/\//.test(publicUrl)) throw new Error("R2_PUBLIC_URL debe comenzar por https://.");

async function api(path, options = {}) {
  const response = await fetch(`${projectUrl}${path}`, {
    ...options,
    headers: { apikey: secretKey, ...options.headers },
  });
  if (!response.ok) throw new Error(`${path}: ${response.status} ${(await response.text()).slice(0, 400)}`);
  return response;
}

async function sourceProducts() {
  if (!sourceUrl) return JSON.parse(await readFile(resolve(publicDir, "catalog-products.json"), "utf8"));
  const response = await fetch(`${sourceUrl}/.netlify/functions/admin?action=list`, {
    headers: sourcePassword ? { Authorization: `Bearer ${sourcePassword}` } : {},
  });
  if (!response.ok) throw new Error(`No se pudo leer el catálogo de origen (${response.status}).`);
  return (await response.json()).products;
}

function imageId(url) {
  const hex = createHash("sha256").update(url).digest("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function imageData(url) {
  if (url.startsWith("/productos-501/")) {
    const file = resolve(publicDir, `.${url}`);
    if (!file.startsWith(`${publicDir}${sep}`)) throw new Error(`Ruta inválida: ${url}`);
    const contentType = extname(file).toLowerCase() === ".png" ? "image/png" : "image/webp";
    return { bytes: await readFile(file), contentType };
  }
  if (url.startsWith("/.netlify/functions/photo?id=")) {
    if (!sourceUrl) throw new Error(`Configura CATALOG_SOURCE_URL para migrar ${url}.`);
    const response = await fetch(`${sourceUrl}${url}`);
    if (!response.ok) throw new Error(`No se pudo descargar ${url} (${response.status}).`);
    return { bytes: await response.arrayBuffer(), contentType: response.headers.get("content-type") || "image/webp" };
  }
  throw new Error(`No se reconoce la foto ${url}.`);
}

const source = await sourceProducts();
if (!Array.isArray(source) || !source.length) throw new Error("El catálogo de origen está vacío.");
const imageCache = new Map();
function loadImage(url) {
  if (!imageCache.has(url)) imageCache.set(url, imageData(url));
  return imageCache.get(url);
}
const { products, excludedBackground, excludedDuplicates } = await curateCatalog(source, loadImage);
if (!products.length) throw new Error("Ningún producto tiene una foto con fondo blanco.");
const references = products.map((product) => product.reference);
if (new Set(references).size !== references.length) throw new Error("Hay referencias repetidas en el catálogo de origen.");
const images = [...new Set(products.flatMap((product) => product.images?.length ? product.images : [product.image]))];
const toCopy = images.filter((url) => url.startsWith("/"));
console.log(`${source.length} productos de origen; ${products.length} con fondo blanco y sin duplicados; ${excludedBackground.length} excluidos por fondo, ${excludedDuplicates.length} referencias repetidas; ${toCopy.length} fotos por copiar.`);
if (excludedBackground.length) console.log(`Sin fondo blanco: ${excludedBackground.join(", ")}`);
if (excludedDuplicates.length) console.log(`Referencias repetidas: ${excludedDuplicates.join(", ")}`);
if (!sourceUrl) console.log("CATALOG_SOURCE_URL no está definido: solo se migrará el JSON incluido en este proyecto.");
if (!apply) {
  console.log("Revisión solamente. Ejecuta con --apply cuando hayas creado Supabase, el bucket R2 público y el esquema SQL.");
} else {
  const r2 = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  const [current] = await (await api("/rest/v1/catalog_state?id=eq.1&select=payload,revision")).json();
  if (!current) throw new Error("Falta catalog_state. Ejecuta supabase/schema.sql en SQL Editor.");
  if (current.payload?.products?.length) throw new Error("El catálogo de Supabase ya tiene productos. No se sobrescribirá.");

  const migrated = new Map();
  for (const [index, url] of toCopy.entries()) {
    const id = imageId(url);
    const path = `catalog/${id}`;
    let exists = true;
    try {
      await r2.send(new HeadObjectCommand({ Bucket: bucket, Key: path }));
    } catch (error) {
      if (error?.$metadata?.httpStatusCode === 404 || error?.name === "NotFound" || error?.name === "NoSuchKey") exists = false;
      else throw error;
    }
    if (!exists) {
      const { bytes } = await loadImage(url);
      const optimized = await optimizedCatalogImage(bytes);
      await r2.send(new PutObjectCommand({ Bucket: bucket, Key: path, Body: optimized, ContentType: "image/webp",
        CacheControl: "public, max-age=31536000, immutable" }));
    }
    migrated.set(url, `${publicUrl}/${path}`);
    console.log(`Foto ${index + 1}/${toCopy.length}`);
  }

  const firstPublicUrl = migrated.values().next().value;
  if (firstPublicUrl) {
    const sample = await fetch(firstPublicUrl);
    if (!sample.ok || !sample.headers.get("content-type")?.startsWith("image/")) {
      throw new Error(`Las fotos no son públicas en R2_PUBLIC_URL (HTTP ${sample.status}). Revisa el acceso público antes de guardar el catálogo.`);
    }
    await sample.body?.cancel();
    console.log("Primera foto verificada en la URL pública de R2.");
  }

  const nextProducts = products.map((product) => {
    const nextImages = (product.images?.length ? product.images : [product.image]).map((url) => migrated.get(url) || url);
    return { ...product, image: nextImages[0], images: nextImages };
  });
  const saved = await (await api("/rest/v1/rpc/catalog_save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expected_revision: current.revision, next_payload: { products: nextProducts, deletedReferences: [...excludedBackground, ...excludedDuplicates] } }),
  })).json();
  if (saved !== true) throw new Error("El catálogo cambió durante la migración. Revisa Supabase antes de reintentar.");
  console.log(`Migración completada: ${nextProducts.length} productos y ${toCopy.length} fotos externas.`);
}
