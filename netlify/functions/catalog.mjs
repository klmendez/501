import { visibleProducts } from "../lib/catalog-products.mjs";
import { catalogStore } from "../lib/supabase.mjs";

export default async (request) => {
  if (request.method !== "GET") return new Response("Método no permitido.", { status: 405 });
  const catalog = catalogStore();
  const products = await catalog.get("products", { type: "json" });
  return Response.json(visibleProducts(products), {
    headers: { "Cache-Control": "no-store" },
  });
};
