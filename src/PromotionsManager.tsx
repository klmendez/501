import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Megaphone, Pencil, Plus, RefreshCw, Trash2, X } from "lucide-react";
import type { Product } from "./data";
import type { Promotion } from "./promotions";

type Draft = Omit<Promotion, "id"> & { id?: string };
const emptyDraft: Draft = { title: "", label: "Selección 501", description: "", productReference: "", placement: "banner", active: true };

async function request(password: string, action: string, options: RequestInit = {}) {
  const response = await fetch(`/.netlify/functions/admin?action=${action}`, {
    ...options,
    headers: { Authorization: `Bearer ${password}`, ...options.headers },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(await response.text() || "No se pudo conectar con el administrador.");
  return response;
}

export default function PromotionsManager({ password }: { password: string }) {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [version, setVersion] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const selectedProduct = useMemo(() => products.find((item) => item.reference === draft?.productReference), [products, draft?.productReference]);

  const load = async () => {
    setLoading(true);
    try {
      const [campaigns, catalog] = await Promise.all([
        request(password, "promotions").then((response) => response.json()) as Promise<{ promotions: Promotion[]; version: string | null }>,
        request(password, "list").then((response) => response.json()) as Promise<{ products: Product[] }>,
      ]);
      setPromotions(Array.isArray(campaigns.promotions) ? campaigns.promotions : []);
      setVersion(campaigns.version);
      setProducts(Array.isArray(catalog.products) ? catalog.products : []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudieron cargar las promociones.");
    } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [password]);

  const update = (changes: Partial<Draft>) => setDraft((current) => current ? { ...current, ...changes } : current);
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft) return;
    setBusy(true);
    setMessage("");
    try {
      await request(password, "promotion-save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version, promotion: draft }) });
      setDraft(null);
      await load();
      setMessage("Promoción guardada. Las campañas activas ya pueden verse en la tienda.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar la promoción.");
    } finally { setBusy(false); }
  };
  const remove = async (promotion: Promotion) => {
    if (!window.confirm(`¿Eliminar la promoción “${promotion.title}”?`)) return;
    setBusy(true);
    setMessage("");
    try {
      await request(password, "promotion-delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version, id: promotion.id }) });
      if (draft?.id === promotion.id) setDraft(null);
      await load();
      setMessage("Promoción eliminada.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo eliminar la promoción.");
    } finally { setBusy(false); }
  };

  return <section className="admin-campaigns">
    <div className="admin-section-heading"><div><span className="admin-kicker">CONTENIDO DE LA TIENDA</span><h1>Promociones</h1><p>Destaca productos sin mostrar precios. Cada campaña lleva al cliente a consultar la prenda.</p></div><button type="button" className="admin-primary-button" disabled={busy || products.length === 0} onClick={() => setDraft({ ...emptyDraft, productReference: products[0]?.reference || "" })}><Plus size={17} /> Nueva promoción</button></div>
    {message && <p className="bulk-notice" role="status">{message}</p>}
    <div className="admin-campaigns__intro"><Megaphone size={19} /><div><strong>Campañas sin descuentos visibles</strong><p>Usa banners para la portada o destacados para dar visibilidad a una prenda. La imagen se toma del producto, sin guardar una copia extra.</p></div></div>
    {loading ? <p>Cargando promociones…</p> : products.length === 0 ? <div className="admin-empty"><Megaphone size={28} /><h2>Publica primero un producto</h2><p>Las promociones se vinculan a productos publicados desde este administrador.</p></div> : promotions.length === 0 ? <div className="admin-empty"><Megaphone size={28} /><h2>Aún no hay promociones</h2><p>Crea un banner para la portada o destaca una prenda del catálogo.</p></div> : <div className="admin-campaigns__list">{promotions.map((promotion) => {
      const product = products.find((item) => item.reference === promotion.productReference);
      return <article className="admin-campaign" key={promotion.id}>
        <div className="admin-campaign__image">{product ? <img src={product.image} alt="" /> : <span>Sin producto</span>}</div>
        <div className="admin-campaign__info"><span>{promotion.placement === "banner" ? "Banner de portada" : "Producto destacado"} · {promotion.active ? "Activo" : "Pausado"}</span><h3>{promotion.title}</h3><p>{promotion.description || product?.name || ""}</p><small>{promotion.productReference}{!product ? " · Producto no disponible" : ""}</small></div>
        <div className="admin-campaign__actions"><button type="button" disabled={busy} onClick={() => setDraft({ ...promotion })}><Pencil size={15} /> Editar</button><button type="button" disabled={busy} onClick={() => void remove(promotion)}><Trash2 size={15} /> Eliminar</button></div>
      </article>;
    })}</div>}
    <button type="button" className="admin-refresh" disabled={loading || busy} onClick={() => void load()}><RefreshCw size={15} /> Actualizar lista</button>
    {draft && <div className="admin-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setDraft(null); }}><form className="admin-campaign-form" onSubmit={(event) => void save(event)}>
      <div className="admin-campaign-form__head"><div><span className="admin-kicker">EDITOR DE CAMPAÑAS</span><h2>{draft.id ? "Editar promoción" : "Nueva promoción"}</h2></div><button type="button" onClick={() => setDraft(null)} disabled={busy} aria-label="Cerrar"><X size={20} /></button></div>
      <div className="admin-campaign-form__grid"><div className="admin-campaign-form__fields">
        <label>Ubicación<select value={draft.placement} onChange={(event) => update({ placement: event.target.value as Promotion["placement"] })}><option value="banner">Banner en portada</option><option value="destacado">Producto destacado</option></select></label>
        <label>Producto<select required value={draft.productReference} onChange={(event) => update({ productReference: event.target.value })}>{products.map((product) => <option key={product.reference} value={product.reference}>{product.name} · {product.reference}</option>)}</select></label>
        <label>Etiqueta breve<input maxLength={40} value={draft.label} onChange={(event) => update({ label: event.target.value })} placeholder="Ej. Nueva colección" /></label>
        <label>Título<input required maxLength={80} value={draft.title} onChange={(event) => update({ title: event.target.value })} placeholder="Ej. Denim que destaca" /></label>
        <label>Texto de apoyo<textarea maxLength={220} rows={3} value={draft.description} onChange={(event) => update({ description: event.target.value })} placeholder="Cuenta qué hace especial esta prenda" /></label>
        <label className="admin-switch"><input type="checkbox" checked={draft.active} onChange={(event) => update({ active: event.target.checked })} /><span>Promoción activa</span></label>
      </div><div className="admin-campaign-form__preview" style={selectedProduct ? { backgroundImage: `linear-gradient(90deg,rgba(0,0,0,.78),rgba(0,0,0,.18)),url(${selectedProduct.image})` } : undefined}><span>{draft.label || "SELECCIÓN 501"}</span><h3>{draft.title || "Título de tu campaña"}</h3><p>{draft.description || selectedProduct?.name || "Selecciona un producto para ver la vista previa."}</p><strong>Ver producto <ArrowRight size={15} /></strong></div></div>
      <div className="admin-campaign-form__footer"><button type="button" onClick={() => setDraft(null)} disabled={busy}>Cancelar</button><button type="submit" disabled={busy}>{busy ? "Guardando…" : "Guardar promoción"}</button></div>
    </form></div>}
  </section>;
}
