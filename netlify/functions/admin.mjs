import { createHash, randomUUID } from "node:crypto";
import { getStore } from "@netlify/blobs";
import { authorizeAdmin } from "../lib/admin-auth.mjs";
import { catalogState, staticProducts, visibleProducts } from "../lib/catalog-products.mjs";
import { catalogStore } from "../lib/supabase.mjs";
import { deletePhoto, photoExists, publicPhotoUrl, r2PhotoId, savePhoto } from "../lib/photo-storage.mjs";
import { hasWhiteBackground, optimizedCatalogImage, whiteBackgroundScore } from "../lib/catalog-image.mjs";

const allowedCategories = new Set(["Jeans", "Chaquetas", "Camisas", "Conjuntos", "Buzos", "Bermudas", "Camisetas"]);
const allowedGenders = new Set(["Mujer", "Hombre", "Unisex"]);
const allowedBadges = new Set(["", "Nuevo", "Destacado", "Top ventas", "Exclusivo", "Pocas unidades"]);
const validPhotoId = (value) => typeof value === "string" && /^[a-f0-9-]{36}$/.test(value);
const photoIdFromUrl = (value) => {
  if (typeof value !== "string" || !value.startsWith("/.netlify/functions/photo?id=")) return null;
  const id = value.slice("/.netlify/functions/photo?id=".length);
  return validPhotoId(id) ? id : null;
};
const imageKeysIn = (products) => new Set(products.flatMap((product) => (product.images || [product.image]).map((url) => {
  const blobId = photoIdFromUrl(url);
  const storageId = r2PhotoId(url);
  return blobId ? `blob:${blobId}` : storageId ? `r2:${storageId}` : null;
}).filter(Boolean)));
const catalogVersion = (snapshot) => snapshot?.etag || createHash("sha256").update(JSON.stringify(snapshot?.data || [])).digest("hex");
const validPromotion = (item) => item && typeof item.title === "string" && item.title.trim().length > 0 && item.title.length <= 80
  && typeof item.label === "string" && item.label.length <= 40
  && typeof item.description === "string" && item.description.length <= 220
  && typeof item.productReference === "string" && /^[a-zA-Z0-9_-]{2,60}$/.test(item.productReference)
  && (item.placement === "banner" || item.placement === "destacado")
  && typeof item.active === "boolean";
async function removeUnusedPhotos(before, after) {
  const retained = imageKeysIn(after);
  for (const key of imageKeysIn(before)) {
    if (!retained.has(key)) {
      const [source, id] = key.split(":");
      try { await deletePhoto(id, source === "r2"); } catch (error) { console.error("No se pudo borrar una foto sin uso", id, error); }
    }
  }
}
const cleanList = (values, fallback) => {
  const cleaned = Array.isArray(values) ? values.filter((value) => typeof value === "string").map((value) => value.trim()).filter(Boolean).slice(0, 30) : [];
  return cleaned.length ? cleaned : fallback;
};

function validDraft(item) {
  return item && typeof item.name === "string" && item.name.trim().length > 0 && item.name.length <= 120
    && typeof item.reference === "string" && /^[a-zA-Z0-9_-]{2,60}$/.test(item.reference)
    && typeof item.brand === "string" && item.brand.length <= 80
    && allowedCategories.has(item.category) && allowedGenders.has(item.gender)
    && Array.isArray(item.imageIds) && item.imageIds.length > 0 && item.imageIds.length <= 20
    && item.imageIds.every(validPhotoId)
    && (item.badge === undefined || allowedBadges.has(item.badge))
    && (item.description === undefined || typeof item.description === "string" && item.description.length <= 1000);
}

function validUpdate(item) {
  return item && typeof item.name === "string" && item.name.trim().length > 0 && item.name.length <= 120
    && typeof item.reference === "string" && /^[a-zA-Z0-9_-]{2,60}$/.test(item.reference)
    && typeof item.brand === "string" && item.brand.length <= 80
    && allowedCategories.has(item.category) && allowedGenders.has(item.gender)
    && Array.isArray(item.images) && item.images.length > 0 && item.images.length <= 20
    && item.images.every((url) => typeof url === "string")
    && (item.badge === undefined || allowedBadges.has(item.badge))
    && (item.description === undefined || typeof item.description === "string" && item.description.length <= 1000);
}

export default async (request) => {
  const denied = authorizeAdmin(request);
  if (denied) return denied;

  const action = new URL(request.url).searchParams.get("action");
  if (request.method === "GET" && action === "status") return Response.json({ ok: true });
  if (request.method === "GET" && action === "list") {
    const snapshot = await catalogStore().getWithMetadata("products", { type: "json" });
    return Response.json({ products: visibleProducts(snapshot?.data), version: catalogVersion(snapshot) }, { headers: { "Cache-Control": "no-store" } });
  }
  if (request.method === "GET" && action === "promotions") {
    const snapshot = await getStore({ name: "catalog-501-promotions", consistency: "strong" }).getWithMetadata("items", { type: "json" });
    return Response.json({ promotions: Array.isArray(snapshot?.data) ? snapshot.data : [], version: snapshot ? catalogVersion(snapshot) : null }, { headers: { "Cache-Control": "no-store" } });
  }

  if (request.method === "POST" && action === "upload") {
    const contentType = request.headers.get("content-type");
    if (contentType !== "image/webp" && contentType !== "image/png") return new Response("Formato no permitido.", { status: 415 });
    const data = await request.arrayBuffer();
    if (data.byteLength === 0 || data.byteLength > 3_000_000) return new Response("La foto supera 3 MB.", { status: 413 });
    let optimized;
    try {
      const bytes = Buffer.from(data);
      if (!hasWhiteBackground(await whiteBackgroundScore(bytes))) return new Response("La foto debe tener fondo blanco.", { status: 422 });
      optimized = await optimizedCatalogImage(bytes);
    } catch {
      return new Response("No se pudo procesar la foto.", { status: 415 });
    }
    const id = randomUUID();
    const url = await savePhoto(id, optimized, "image/webp");
    return Response.json({ id, url });
  }

  if (request.method === "POST" && action === "publish") {
    const body = await request.text();
    if (body.length > 500_000) return new Response("El lote es demasiado grande.", { status: 413 });
    let incoming;
    try { incoming = JSON.parse(body); } catch { return new Response("Datos no válidos.", { status: 400 }); }
    if (!Array.isArray(incoming.products) || !incoming.products.length || incoming.products.length > 100 || !incoming.products.every(validDraft)) {
      return new Response("Revisa los datos de los productos.", { status: 400 });
    }
    const references = incoming.products.map((item) => item.reference);
    if (new Set(references).size !== references.length) return new Response("Hay referencias repetidas.", { status: 400 });

    const imageIds = [...new Set(incoming.products.flatMap((item) => item.imageIds))];
    for (const id of imageIds) {
      if (!await photoExists(id)) return new Response("Falta una foto del lote. Vuelve a subirla.", { status: 400 });
    }

    const catalog = catalogStore();
    const snapshot = await catalog.getWithMetadata("products", { type: "json" });
    const state = catalogState(snapshot?.data);
    const existing = state.products;
    const staticByReference = new Map(staticProducts.map((item) => [item.reference, item]));
    const oldByReference = new Map(existing.map((item) => [item.reference, item]));
    let nextId = Math.max(1000, ...visibleProducts(snapshot?.data).map((item) => Number(item.id) || 0)) + 1;
    const prepared = incoming.products.map((item) => {
      const images = item.imageIds.map(publicPhotoUrl);
      return {
        id: oldByReference.get(item.reference)?.id ?? staticByReference.get(item.reference)?.id ?? nextId++,
        name: item.name.trim(),
        reference: item.reference,
        brand: item.brand.trim() || "501",
        category: item.category,
        gender: item.gender,
        image: images[0],
        images,
        minimum: Math.max(1, Number(item.minimum) || 1),
        sizes: cleanList(item.sizes, ["Única"]),
        colors: cleanList(item.colors, ["Por confirmar"]),
        description: item.description?.trim() || "",
        badge: item.badge || undefined,
      };
    });
    const updated = [...prepared, ...existing.filter((item) => !references.includes(item.reference))];
    const next = { products: updated, deletedReferences: state.deletedReferences.filter((reference) => !references.includes(reference)) };
    const result = await catalog.set("products", JSON.stringify(next), snapshot
      ? snapshot.etag ? { onlyIfMatch: snapshot.etag } : {}
      : { onlyIfNew: true });
    if (!result.modified) return new Response("El catálogo cambió mientras publicabas. Inténtalo de nuevo.", { status: 409 });
    await removeUnusedPhotos(existing, updated);
    return Response.json({ count: prepared.length });
  }

  if (request.method === "POST" && (action === "update" || action === "delete")) {
    const body = await request.text();
    if (body.length > 50_000) return new Response("La solicitud es demasiado grande.", { status: 413 });
    let incoming;
    try { incoming = JSON.parse(body); } catch { return new Response("Datos no válidos.", { status: 400 }); }
    if (typeof incoming?.originalReference !== "string" || typeof incoming.version !== "string") return new Response("Falta la referencia o versión del catálogo.", { status: 400 });

    const catalog = catalogStore();
    const snapshot = await catalog.getWithMetadata("products", { type: "json" });
    if (catalogVersion(snapshot) !== incoming.version) return new Response("El catálogo cambió. Recarga la lista antes de guardar.", { status: 409 });
    const state = catalogState(snapshot?.data);
    const existing = state.products;
    const original = visibleProducts(snapshot?.data).find((item) => item.reference === incoming.originalReference);
    if (!original) return new Response("Producto no encontrado.", { status: 404 });

    let updated;
    if (action === "delete") {
      updated = {
        products: existing.filter((item) => item.reference !== incoming.originalReference),
        deletedReferences: [...new Set([...state.deletedReferences, incoming.originalReference])],
      };
    } else {
      const item = incoming.product;
      if (!validUpdate(item)) return new Response("Revisa los datos del producto.", { status: 400 });
      if (visibleProducts(snapshot?.data).some((current) => current.reference !== incoming.originalReference && current.reference === item.reference)) return new Response("Ya existe un producto con esa referencia.", { status: 409 });
      const allowedExisting = new Set(original.images?.length ? original.images : [original.image]);
      for (const url of new Set(item.images)) {
        if (allowedExisting.has(url)) continue;
        const storageId = r2PhotoId(url);
        const blobId = photoIdFromUrl(url);
        if (storageId || blobId) {
          if (!await photoExists(storageId || blobId, Boolean(storageId))) return new Response("Falta una foto. Vuelve a subirla.", { status: 400 });
        } else {
          return new Response("La foto no pertenece a este producto.", { status: 400 });
        }
      }
      const prepared = {
        ...original,
        name: item.name.trim(),
        reference: item.reference,
        brand: item.brand.trim() || "501",
        category: item.category,
        gender: item.gender,
        image: item.images[0],
        images: item.images,
        minimum: Math.max(1, Number(item.minimum) || 1),
        sizes: cleanList(item.sizes, []),
        colors: cleanList(item.colors, ["Por confirmar"]),
        description: item.description?.trim() || "",
        badge: item.badge || undefined,
      };
      updated = {
        products: [prepared, ...existing.filter((current) => current.reference !== incoming.originalReference)],
        deletedReferences: [...new Set([...state.deletedReferences, incoming.originalReference])].filter((reference) => reference !== item.reference),
      };
    }
    const result = await catalog.set("products", JSON.stringify(updated), snapshot
      ? snapshot.etag ? { onlyIfMatch: snapshot.etag } : {}
      : { onlyIfNew: true });
    if (!result.modified) return new Response("El catálogo cambió. Recarga la lista antes de guardar.", { status: 409 });
    await removeUnusedPhotos(existing, updated.products);
    return Response.json({ ok: true });
  }

  if (request.method === "POST" && (action === "promotion-save" || action === "promotion-delete")) {
    const body = await request.text();
    if (body.length > 10_000) return new Response("La solicitud es demasiado grande.", { status: 413 });
    let incoming;
    try { incoming = JSON.parse(body); } catch { return new Response("Datos no válidos.", { status: 400 }); }
    const store = getStore({ name: "catalog-501-promotions", consistency: "strong" });
    const snapshot = await store.getWithMetadata("items", { type: "json" });
    const current = Array.isArray(snapshot?.data) ? snapshot.data : [];
    if ((snapshot ? catalogVersion(snapshot) : null) !== (incoming?.version ?? null)) return new Response("Las promociones cambiaron. Actualiza la lista.", { status: 409 });
    let next;
    if (action === "promotion-delete") {
      if (typeof incoming.id !== "string" || !current.some((item) => item.id === incoming.id)) return new Response("Promoción no encontrada.", { status: 404 });
      next = current.filter((item) => item.id !== incoming.id);
    } else {
      if (!validPromotion(incoming.promotion)) return new Response("Revisa los datos de la promoción.", { status: 400 });
      const item = incoming.promotion;
      const productCatalog = await catalogStore().get("products", { type: "json" });
      if (!visibleProducts(productCatalog).some((product) => product.reference === item.productReference)) return new Response("Elige un producto publicado desde el administrador.", { status: 400 });
      const id = typeof item.id === "string" && current.some((promotion) => promotion.id === item.id) ? item.id : randomUUID();
      const prepared = { id, title: item.title.trim(), label: item.label.trim(), description: item.description.trim(), productReference: item.productReference, placement: item.placement, active: item.active };
      next = current.some((promotion) => promotion.id === id)
        ? current.map((promotion) => promotion.id === id ? prepared : promotion)
        : [prepared, ...current];
      if (next.length > 24) return new Response("Puedes guardar hasta 24 promociones.", { status: 400 });
    }
    const result = await store.set("items", JSON.stringify(next), snapshot ? snapshot.etag ? { onlyIfMatch: snapshot.etag } : {} : { onlyIfNew: true });
    if (!result.modified) return new Response("Las promociones cambiaron. Actualiza la lista.", { status: 409 });
    return Response.json({ ok: true });
  }

  return new Response("Ruta no encontrada.", { status: 404 });
};
