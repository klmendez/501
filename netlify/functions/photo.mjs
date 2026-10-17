import { getStore } from "@netlify/blobs";

export default async (request) => {
  if (request.method !== "GET") return new Response("Método no permitido.", { status: 405 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id || !/^[a-f0-9-]{36}$/.test(id)) return new Response("Foto no válida.", { status: 400 });
  const store = getStore({ name: "catalog-501-photos", consistency: "strong" });
  const photo = await store.getWithMetadata(id, { type: "arrayBuffer" });
  if (!photo) return new Response("Foto no encontrada.", { status: 404 });
  return new Response(photo.data, {
    headers: {
      "Content-Type": photo.metadata?.contentType || "image/webp",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
};
