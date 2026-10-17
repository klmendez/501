import { getStore } from "@netlify/blobs";

export default async (request) => {
  if (request.method !== "GET") return new Response("Método no permitido.", { status: 405 });
  const store = getStore({ name: "catalog-501-promotions", consistency: "strong" });
  const promotions = await store.get("items", { type: "json" });
  return Response.json(Array.isArray(promotions) ? promotions.filter((item) => item.active) : [], {
    headers: { "Cache-Control": "no-store" },
  });
};
