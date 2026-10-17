import test from "node:test";
import assert from "node:assert/strict";
import { S3Client } from "@aws-sdk/client-s3";
import sharp from "sharp";

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SECRET_KEY = "sb_secret_test";
process.env.R2_ACCOUNT_ID = "test-account";
process.env.R2_ACCESS_KEY_ID = "test-access";
process.env.R2_SECRET_ACCESS_KEY = "test-secret";
process.env.R2_BUCKET = "catalogo-501";
process.env.R2_PUBLIC_URL = "https://fotos.example.com";

const { catalogStore } = await import("./supabase.mjs");
const { deletePhoto, photoExists, publicPhotoUrl, r2PhotoId, savePhoto } = await import("./photo-storage.mjs");
const { default: admin } = await import("../functions/admin.mjs");

test("lee y guarda el catálogo con control de versión", async (context) => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    assert.equal(options.headers.apikey, "sb_secret_test");
    if (url.includes("catalog_state")) return Response.json([{ payload: { products: [], deletedReferences: [] }, revision: 4 }]);
    if (url.includes("catalog_save")) return Response.json(true);
    throw new Error(`Ruta inesperada: ${url}`);
  };
  context.after(() => { globalThis.fetch = originalFetch; });

  const store = catalogStore();
  const snapshot = await store.getWithMetadata("products", { type: "json" });
  assert.equal(snapshot.etag, "4");
  assert.deepEqual(snapshot.data.products, []);
  assert.deepEqual(await store.set("products", JSON.stringify({ products: [{ reference: "X" }], deletedReferences: [] }), { onlyIfMatch: snapshot.etag }), { modified: true });
  assert.deepEqual(JSON.parse(calls[1].options.body), { expected_revision: 4, next_payload: { products: [{ reference: "X" }], deletedReferences: [] } });
});

test("sube, comprueba y borra una foto de R2", async (context) => {
  const originalSend = S3Client.prototype.send;
  const calls = [];
  S3Client.prototype.send = async (command) => { calls.push(command); return {}; };
  context.after(() => { S3Client.prototype.send = originalSend; });

  const id = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
  const url = await savePhoto(id, new Uint8Array([1, 2, 3]), "image/webp");
  assert.equal(url, publicPhotoUrl(id));
  assert.equal(r2PhotoId(url), id);
  assert.equal(await photoExists(id), true);
  await deletePhoto(id, true);
  assert.deepEqual(calls.map((command) => command.constructor.name), ["PutObjectCommand", "HeadObjectCommand", "DeleteObjectCommand"]);
  assert.deepEqual(calls[0].input.Body, Buffer.from([1, 2, 3]));
  assert.equal(calls[0].input.ContentType, "image/webp");
  assert.equal(calls[0].input.Key, `catalog/${id}`);
});

test("/admin acepta una foto con otro fondo y la reduce antes de subirla", async (context) => {
  const originalSend = S3Client.prototype.send;
  let uploaded;
  S3Client.prototype.send = async (command) => { uploaded = command.input; return {}; };
  context.after(() => { S3Client.prototype.send = originalSend; });

  const photo = await sharp({ create: { width: 1600, height: 2400, channels: 3, background: { r: 120, g: 90, b: 70 } } }).png().toBuffer();
  const response = await admin(new Request("http://localhost:5173/.netlify/functions/admin?action=upload", {
    method: "POST", headers: { "Content-Type": "image/png" }, body: photo,
  }));
  assert.equal(response.status, 200);
  assert.equal(uploaded.ContentType, "image/webp");
  const dimensions = await sharp(uploaded.Body).metadata();
  assert.equal(dimensions.width, 800);
  assert.equal(dimensions.height, 1200);
});

test("/admin guarda un JPG reducido como WebP en R2", async (context) => {
  const originalSend = S3Client.prototype.send;
  let uploaded;
  S3Client.prototype.send = async (command) => { uploaded = command.input; return {}; };
  context.after(() => { S3Client.prototype.send = originalSend; });

  const photo = await sharp({ create: { width: 1800, height: 1200, channels: 3, background: { r: 40, g: 60, b: 90 } } }).jpeg({ quality: 95 }).toBuffer();
  const response = await admin(new Request("http://localhost:5173/.netlify/functions/admin?action=upload", {
    method: "POST", headers: { "Content-Type": "image/jpeg" }, body: photo,
  }));
  assert.equal(response.status, 200);
  assert.equal(uploaded.ContentType, "image/webp");
  const metadata = await sharp(uploaded.Body).metadata();
  assert.equal(metadata.format, "webp");
  assert.equal(metadata.width, 1200);
  assert.equal(metadata.height, 800);
});

test("/admin publica un producto con foto en R2 y datos en Supabase", async (context) => {
  const originalFetch = globalThis.fetch;
  const originalSend = S3Client.prototype.send;
  const id = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
  let saved;
  S3Client.prototype.send = async (command) => {
    assert.equal(command.constructor.name, "HeadObjectCommand");
    return {};
  };
  globalThis.fetch = async (url, options = {}) => {
    assert.equal(options.headers.apikey, "sb_secret_test");
    if (url.includes("catalog_state")) return Response.json([{ payload: { products: [], deletedReferences: [] }, revision: 0 }]);
    if (url.includes("catalog_save")) {
      saved = JSON.parse(options.body).next_payload;
      return Response.json(true);
    }
    throw new Error(`Ruta inesperada: ${url}`);
  };
  context.after(() => { globalThis.fetch = originalFetch; S3Client.prototype.send = originalSend; });

  const response = await admin(new Request("http://localhost:5173/.netlify/functions/admin?action=publish", {
    method: "POST",
    body: JSON.stringify({ products: [{
      name: "Chaqueta de prueba", reference: "TEST-001", brand: "Diesel", category: "Chaquetas", gender: "Hombre",
      imageIds: [id], minimum: 1, sizes: ["M"], colors: ["Negro"], description: "Prueba",
    }] }),
  }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).count, 1);
  assert.equal(saved.products[0].reference, "TEST-001");
  assert.equal(saved.products[0].image, publicPhotoUrl(id));
});
