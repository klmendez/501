import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Camera, ImagePlus, LayoutGrid, Megaphone, Package, Sparkles } from "lucide-react";
import type { Product } from "./data";
import type { Promotion } from "./promotions";

type Section = "overview" | "products" | "upload" | "promotions";

async function getAdmin(password: string, action: string) {
  const response = await fetch(`/.netlify/functions/admin?action=${action}`, { headers: { Authorization: `Bearer ${password}` }, cache: "no-store" });
  if (!response.ok) throw new Error(await response.text() || "No se pudo cargar el resumen.");
  return response.json();
}

export default function AdminOverview({ password, revision, onNavigate }: { password: string; revision: number; onNavigate: (section: Section) => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([getAdmin(password, "list"), getAdmin(password, "promotions")])
      .then(([catalog, campaigns]) => {
        if (cancelled) return;
        setProducts(Array.isArray(catalog.products) ? catalog.products : []);
        setPromotions(Array.isArray(campaigns.promotions) ? campaigns.promotions : []);
        setError("");
      })
      .catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : "No se pudo cargar el resumen."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [password, revision]);

  const photoCount = products.reduce((sum, product) => sum + (product.images?.length || 1), 0);
  const categoryCounts = useMemo(() => ["Jeans", "Chaquetas", "Camisas", "Conjuntos", "Buzos", "Bermudas", "Camisetas"].map((name) => ({ name, count: products.filter((product) => product.category === name).length })), [products]);
  const topCategory = Math.max(1, ...categoryCounts.map((item) => item.count));
  const activePromotions = promotions.filter((item) => item.active).length;
  const stats = [
    { label: "Productos publicados", value: products.length, icon: Package, detail: "Visibles en el catálogo" },
    { label: "Fotos en catálogo", value: photoCount, icon: Camera, detail: "En productos publicados" },
    { label: "Categorías en uso", value: categoryCounts.filter((item) => item.count).length, icon: LayoutGrid, detail: "Jeans, chaquetas y más" },
    { label: "Promociones activas", value: activePromotions, icon: Megaphone, detail: "Visibles en la tienda" },
  ];

  return <section className="admin-overview">
    <div className="admin-section-heading"><div><span className="admin-kicker">PANEL GENERAL</span><h1>Tu tienda, de un vistazo</h1><p>Administra el catálogo, prepara nuevos lanzamientos y destaca lo que quieres vender.</p></div><button type="button" className="admin-primary-button" onClick={() => onNavigate("upload")}><ImagePlus size={17} /> Subir productos</button></div>
    {error && <p className="bulk-notice" role="status">{error}</p>}
    <div className="admin-hero-card"><div><span><Sparkles size={15} /> 501 · CENTRO DE CONTROL</span><h2>Una vitrina siempre<br />lista para mostrar.</h2><p>Organiza tus prendas, actualiza sus fotos y crea campañas que inviten a conversar por WhatsApp.</p><button type="button" onClick={() => onNavigate("promotions")}>Crear una promoción <ArrowRight size={16} /></button></div><div className="admin-hero-card__visual"><span>501</span><small>DENIM & STYLE</small></div></div>
    <div className="admin-stat-grid">{stats.map((stat) => <div className="admin-stat" key={stat.label}><div className="admin-stat__icon"><stat.icon size={21} /></div><span>{stat.label}</span><strong>{loading ? "—" : stat.value.toLocaleString("es-CO")}</strong><small>{stat.detail}</small></div>)}</div>
    <div className="admin-overview__grid"><section className="admin-panel"><div className="admin-panel__head"><div><span className="admin-kicker">INVENTARIO</span><h2>Por categoría</h2></div><button type="button" onClick={() => onNavigate("products")}>Ver productos <ArrowRight size={15} /></button></div><div className="admin-category-bars">{categoryCounts.map((item) => <div className="admin-category-bar" key={item.name}><div><span>{item.name}</span><strong>{item.count}</strong></div><div className="admin-category-bar__track"><span style={{ width: `${Math.max(0, item.count / topCategory * 100)}%` }} /></div></div>)}</div></section>
      <section className="admin-panel"><div className="admin-panel__head"><div><span className="admin-kicker">ÚLTIMOS PRODUCTOS</span><h2>Recién publicados</h2></div><button type="button" onClick={() => onNavigate("products")}>Ver todos <ArrowRight size={15} /></button></div>{products.length ? <div className="admin-recent-products">{products.slice(0, 4).map((product) => <div key={product.reference}><img src={product.image} alt="" loading="lazy" /><div><strong>{product.name}</strong><span>{product.reference} · {product.category}</span></div></div>)}</div> : <p className="admin-panel__empty">Tus próximos productos aparecerán aquí.</p>}</section></div>
    <div className="admin-overview__footnote">Estas estadísticas describen todos los productos visibles en la tienda. La tienda no registra ventas realizadas por WhatsApp.</div>
  </section>;
}
