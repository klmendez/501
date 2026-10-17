import { createHash, timingSafeEqual } from "node:crypto";

export function authorizeAdmin(request) {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get("origin");
  if (origin && origin !== requestUrl.origin) return new Response("Origen no permitido.", { status: 403 });

  const local = requestUrl.hostname === "localhost" || requestUrl.hostname === "127.0.0.1";
  if (local) return null;

  const configured = process.env.CATALOG_ADMIN_PASSWORD;
  if (!configured || configured.length < 16) return new Response("Configura en Netlify una clave de administrador de al menos 16 caracteres.", { status: 503 });

  const productionUrl = process.env.URL;
  if (productionUrl && requestUrl.hostname !== new URL(productionUrl).hostname) {
    return new Response("El administrador solo está disponible en el sitio principal.", { status: 403 });
  }

  const supplied = request.headers.get("authorization")?.replace(/^Bearer /i, "") || "";
  const actualHash = createHash("sha256").update(configured).digest();
  const suppliedHash = createHash("sha256").update(supplied).digest();
  if (!timingSafeEqual(actualHash, suppliedHash)) return new Response("Clave incorrecta.", { status: 401 });
  return null;
}
