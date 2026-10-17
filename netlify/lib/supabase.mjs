import { getStore } from "@netlify/blobs";

function config() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url && !key) return null;
  if (!url || !key) throw new Error("Configura SUPABASE_URL y SUPABASE_SECRET_KEY juntas.");
  if (!/^https:\/\//.test(url)) throw new Error("SUPABASE_URL debe comenzar por https://.");
  return { url, key };
}

export function usingSupabase() {
  return Boolean(config());
}

async function supabaseRequest(path, options = {}) {
  const settings = config();
  if (!settings) throw new Error("Supabase no está configurado.");
  const response = await fetch(`${settings.url}${path}`, {
    ...options,
    headers: { apikey: settings.key, ...options.headers },
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`Supabase respondió ${response.status}: ${detail}`);
  }
  return response;
}

export function catalogStore() {
  if (!usingSupabase()) return getStore({ name: "catalog-501", consistency: "strong" });
  return {
    async getWithMetadata() {
      const response = await supabaseRequest("/rest/v1/catalog_state?id=eq.1&select=payload,revision");
      const [row] = await response.json();
      if (!row) throw new Error("Falta la tabla catalog_state. Ejecuta supabase/schema.sql.");
      return { data: row.payload, etag: String(row.revision) };
    },
    async get() {
      return (await this.getWithMetadata()).data;
    },
    async set(_key, value, options = {}) {
      const expected = options.onlyIfMatch ?? (options.onlyIfNew ? "0" : null);
      if (expected === null) throw new Error("Falta la versión del catálogo.");
      const response = await supabaseRequest("/rest/v1/rpc/catalog_save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expected_revision: Number(expected), next_payload: JSON.parse(value) }),
      });
      return { modified: await response.json() === true };
    },
  };
}

