import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Pencil, RefreshCw, Trash2, UploadCloud, X } from "lucide-react";
import { optimizedImage } from "./adminImages";
import { categories, type Category, type Gender, type Product } from "./data";

type EditPhoto = { key: string; url: string; file?: File };
const acceptedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

async function request(password: string, action: string, options: RequestInit = {}) {
  const response = await fetch(`/.netlify/functions/admin?action=${action}`, {
    ...options,
    headers: { Authorization: `Bearer ${password}`, ...options.headers },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(await response.text() || "No se pudo conectar con el administrador.");
  return response;
}

export default function PublishedProducts({ password, revision }: { password: string; revision: number }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [version, setVersion] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Product | null>(null);
  const [originalReference, setOriginalReference] = useState("");
  const [photos, setPhotos] = useState<EditPhoto[]>([]);
  const photosRef = useRef<EditPhoto[]>([]);
  const editorRef = useRef<HTMLFormElement>(null);
  const visible = useMemo(() => products.filter((product) => `${product.name} ${product.reference} ${product.brand}`.toLowerCase().includes(query.toLowerCase())), [products, query]);

  const load = async () => {
    setLoading(true);
    try {
      const result = await request(password, "list").then((response) => response.json()) as { products: Product[]; version: string | null };
      setProducts(Array.isArray(result.products) ? result.products : []);
      setVersion(result.version);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo cargar el catálogo.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [password, revision]);
  useEffect(() => { photosRef.current = photos; }, [photos]);
  useEffect(() => () => photosRef.current.forEach((photo) => { if (photo.file) URL.revokeObjectURL(photo.url); }), []);
  useEffect(() => { if (originalReference) requestAnimationFrame(() => editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })); }, [originalReference]);

  const closeEdit = () => {
    photosRef.current.forEach((photo) => { if (photo.file) URL.revokeObjectURL(photo.url); });
    setEditing(null);
    setOriginalReference("");
    setPhotos([]);
  };
  const startEdit = (product: Product) => {
    closeEdit();
    setEditing({ ...product, sizes: [...product.sizes], colors: [...product.colors] });
    setOriginalReference(product.reference);
    setPhotos((product.images?.length ? product.images : [product.image]).map((url) => ({ key: url, url })));
    setMessage("");
  };
  const update = (changes: Partial<Product>) => setEditing((current) => current ? { ...current, ...changes } : current);
  const addPhotos = (files: FileList | null) => {
    if (!files?.length) return;
    const accepted = Array.from(files).filter((file) => acceptedTypes.has(file.type) && file.size <= 15 * 1024 * 1024);
    if (accepted.length !== files.length) setMessage("Algunas fotos se omitieron: usa JPG, PNG o WebP de hasta 15 MB.");
    setPhotos((current) => [...current, ...accepted.map((file) => ({ key: crypto.randomUUID(), url: URL.createObjectURL(file), file }))]);
  };
  const removePhoto = (key: string) => setPhotos((current) => {
    const removed = current.find((photo) => photo.key === key);
    if (removed?.file) URL.revokeObjectURL(removed.url);
    return current.filter((photo) => photo.key !== key);
  });
  const movePhoto = (index: number, direction: -1 | 1) => setPhotos((current) => {
    const next = [...current];
    const target = index + direction;
    if (target < 0 || target >= next.length) return current;
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  });

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing || !version) return;
    if (!photos.length) { setMessage("El producto necesita al menos una foto."); return; }
    if (!/^[a-zA-Z0-9_-]{2,60}$/.test(editing.reference.trim())) { setMessage("La referencia debe tener 2 a 60 letras, números o guiones."); return; }
    setBusy(true);
    setMessage("");
    try {
      const images: string[] = [];
      for (const photo of photos) {
        if (!photo.file) { images.push(photo.url); continue; }
        setMessage(`Subiendo ${photo.file.name}…`);
        const image = await optimizedImage(photo.file);
        const result = await request(password, "upload", { method: "POST", body: image, headers: { "Content-Type": image.type } }).then((response) => response.json()) as { id: string; url?: string };
        images.push(result.url || `/.netlify/functions/photo?id=${result.id}`);
      }
      await request(password, "update", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        originalReference,
        version,
        product: {
          name: editing.name.trim(), reference: editing.reference.trim(), brand: editing.brand.trim(),
          category: editing.category, gender: editing.gender, minimum: editing.minimum,
          sizes: editing.sizes, colors: editing.colors, description: editing.description, badge: editing.badge || "", images,
        },
      }) });
      closeEdit();
      await load();
      setMessage("Producto actualizado. Los cambios ya aparecen en la tienda.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo actualizar el producto.");
    } finally { setBusy(false); }
  };

  const remove = async (product: Product) => {
    if (!version || !window.confirm(`¿Eliminar ${product.name} (${product.reference}) de la tienda?`)) return;
    setBusy(true);
    setMessage("");
    try {
      await request(password, "delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ originalReference: product.reference, version }) });
      if (originalReference === product.reference) closeEdit();
      await load();
      setMessage("Producto eliminado de la tienda.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo eliminar el producto.");
    } finally { setBusy(false); }
  };

  return <section className="published-products" aria-labelledby="published-title">
    <div className="published-products__heading">
      <div><span className="admin-kicker">GESTIÓN DE INVENTARIO</span><h1 id="published-title">Productos de la tienda</h1><p>Busca cualquier referencia para modificar sus datos, fotos o retirarla de la tienda.</p></div>
      <button type="button" onClick={() => void load()} disabled={loading || busy}><RefreshCw size={16} /> Actualizar lista</button>
    </div>
    {message && <p className="bulk-notice" role="status">{message}</p>}
    {loading ? <p>Cargando productos…</p> : products.length === 0 ? <p>Aún no hay productos en la tienda.</p> : <>
      <input className="published-products__search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre, referencia o marca" aria-label="Buscar productos publicados" />
      <p className="published-products__count">{visible.length} de {products.length} productos</p>
      <div className="published-products__list">{visible.map((product) => <article className="published-product" key={product.id}>
        <img src={product.image} alt="" loading="lazy" />
        <div className="published-product__info"><strong>{product.name}</strong><span>{product.reference} · {product.brand} · {product.category}</span><small>{product.images?.length || 1} foto{(product.images?.length || 1) === 1 ? "" : "s"}</small></div>
        <div className="published-product__actions"><button type="button" onClick={() => startEdit(product)} disabled={busy}><Pencil size={15} /> Editar</button><button type="button" className="published-product__delete" onClick={() => void remove(product)} disabled={busy}><Trash2 size={15} /> Eliminar</button></div>
      </article>)}</div>
    </>}
    {editing && <form className="published-editor" ref={editorRef} onSubmit={(event) => void save(event)}>
      <div className="published-editor__head"><div><h3>Editar {originalReference}</h3><p>La primera foto será la portada. Cambiar la referencia modifica el enlace del producto.</p></div><button type="button" onClick={closeEdit} disabled={busy} aria-label="Cerrar edición"><X size={20} /></button></div>
      <div className="published-editor__photos">{photos.map((photo, index) => <div className="published-editor__photo" key={photo.key}>
        <img src={photo.url} alt={`Foto ${index + 1}`} />
        <span>{index === 0 ? "Portada" : `Foto ${index + 1}`}</span>
        <div><button type="button" onClick={() => movePhoto(index, -1)} disabled={busy || index === 0} aria-label="Mover foto a la izquierda"><ArrowUp size={15} /></button><button type="button" onClick={() => movePhoto(index, 1)} disabled={busy || index === photos.length - 1} aria-label="Mover foto a la derecha"><ArrowDown size={15} /></button><button type="button" onClick={() => removePhoto(photo.key)} disabled={busy} aria-label="Quitar foto"><Trash2 size={15} /></button></div>
      </div>)}</div>
      <label className="published-editor__add">Agregar fotos<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => { addPhotos(event.target.files); event.target.value = ""; }} disabled={busy} /></label>
      <div className="bulk-fields">
        <label>Nombre<input required maxLength={120} value={editing.name} onChange={(event) => update({ name: event.target.value })} /></label>
        <label>Referencia única<input required maxLength={60} value={editing.reference} onChange={(event) => update({ reference: event.target.value })} /></label>
        <label>Marca<input maxLength={80} value={editing.brand} onChange={(event) => update({ brand: event.target.value })} /></label>
        <label>Categoría<select value={editing.category} onChange={(event) => update({ category: event.target.value as Category })}>{categories.map((item) => <option key={item.name}>{item.name}</option>)}</select></label>
        <label>Para<select value={editing.gender} onChange={(event) => update({ gender: event.target.value as Gender })}><option>Mujer</option><option>Hombre</option><option>Unisex</option></select></label>
        <label>Mínimo mayorista<input type="number" min="1" value={editing.minimum} onChange={(event) => update({ minimum: Number(event.target.value) })} /></label>
        <label>Tallas, separadas por coma<input value={editing.sizes.join(", ")} onChange={(event) => update({ sizes: event.target.value.split(",").map((value) => value.trim()) })} /></label>
        <label>Colores, separados por coma<input value={editing.colors.join(", ")} onChange={(event) => update({ colors: event.target.value.split(",").map((value) => value.trim()) })} /></label>
        <label>Etiqueta en la tienda<select value={editing.badge || ""} onChange={(event) => update({ badge: event.target.value || undefined })}><option value="">Sin etiqueta</option><option>Nuevo</option><option>Destacado</option><option>Top ventas</option><option>Exclusivo</option><option>Pocas unidades</option></select></label>
        <label className="bulk-fields__wide">Descripción<textarea rows={3} maxLength={1000} value={editing.description} onChange={(event) => update({ description: event.target.value })} /></label>
      </div>
      <div className="published-editor__actions"><button type="button" onClick={closeEdit} disabled={busy}>Cancelar</button><button type="submit" disabled={busy}><UploadCloud size={16} /> {busy ? "Guardando…" : "Guardar cambios"}</button></div>
    </form>}
  </section>;
}
