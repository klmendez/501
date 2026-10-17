import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Download, ExternalLink, ImagePlus, LayoutDashboard, LogOut, Megaphone, Menu, Merge, Package, Scissors, Trash2, UploadCloud, X } from "lucide-react";
import { fingerprintImage, suggestPhotoGroups, visuallySimilar, type UploadPhoto } from "./bulkGrouping";
import { categories, type Category, type Gender } from "./data";
import { optimizedImage } from "./adminImages";
import PublishedProducts from "./PublishedProducts";
import AdminOverview from "./AdminOverview";
import PromotionsManager from "./PromotionsManager";

type AdminSection = "overview" | "products" | "upload" | "promotions";

type Draft = {
  id: string;
  photoIds: string[];
  name: string;
  reference: string;
  brand: string;
  category: Category;
  gender: Gender;
  minimum: number;
  sizes: string;
  colors: string;
  description: string;
  badge: string;
};

const acceptedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

async function adminRequest(password: string, action: string, options: RequestInit = {}) {
  const response = await fetch(`/.netlify/functions/admin?action=${action}`, {
    ...options,
    headers: { Authorization: `Bearer ${password}`, ...options.headers },
  });
  if (!response.ok) throw new Error(await response.text() || "No se pudo conectar con el administrador.");
  return response;
}

function draftFromPhotos(photos: UploadPhoto[]): Draft {
  const label = photos[0].fingerprint.filenameKey || "Nuevo producto";
  return {
    id: crypto.randomUUID(),
    photoIds: photos.map((photo) => photo.id),
    name: label.replace(/\b\w/g, (letter) => letter.toUpperCase()),
    reference: "",
    brand: "501",
    category: "Jeans",
    gender: "Mujer",
    minimum: 1,
    sizes: "",
    colors: "",
    description: "",
    badge: "",
  };
}

export default function BulkUpload() {
  const local = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(local);
  const [photos, setPhotos] = useState<UploadPhoto[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [publishedRevision, setPublishedRevision] = useState(0);
  const [section, setSection] = useState<AdminSection>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const photosRef = useRef<UploadPhoto[]>([]);
  const uploadedIds = useRef(new Map<string, string>());

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);
  useEffect(() => () => photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.preview)), []);

  const updateDraft = (id: string, update: Partial<Draft>) => {
    setDrafts((current) => current.map((draft) => draft.id === id ? { ...draft, ...update } : draft));
  };

  const login = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await adminRequest(password, "status");
      setAuthenticated(true);
      setNotice("");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo ingresar.");
    } finally {
      setBusy(false);
    }
  };

  const logout = () => {
    photos.forEach((photo) => URL.revokeObjectURL(photo.preview));
    setPhotos([]);
    setDrafts([]);
    uploadedIds.current.clear();
    setPassword("");
    setAuthenticated(false);
    setNotice("");
    setSection("overview");
  };

  const addFiles = async (files: FileList | null) => {
    if (busy || !files?.length) return;
    setBusy(true);
    const valid = Array.from(files).filter((file) => acceptedTypes.has(file.type) && file.size <= 15 * 1024 * 1024);
    const rejected = files.length - valid.length;
    const created: UploadPhoto[] = [];
    try {
      for (const file of valid) {
        const fingerprint = await fingerprintImage(file);
        created.push({ id: crypto.randomUUID(), file, preview: URL.createObjectURL(file), fingerprint });
      }
      const nextDrafts = drafts.map((draft) => ({ ...draft, photoIds: [...draft.photoIds] }));
      for (const group of suggestPhotoGroups(created)) {
        const match = nextDrafts.find((draft) => draft.photoIds.some((id) => {
          const existing = photos.find((photo) => photo.id === id);
          return existing && group.some((photo) => visuallySimilar(existing.fingerprint, photo.fingerprint));
        }));
        if (match) match.photoIds.push(...group.map((photo) => photo.id));
        else nextDrafts.push(draftFromPhotos(group));
      }
      setPhotos((current) => [...current, ...created]);
      setDrafts(nextDrafts);
      setNotice(`${created.length} fotos analizadas; revisa los ${nextDrafts.length} grupos sugeridos.${rejected ? ` ${rejected} archivos omitidos (solo JPG, PNG o WebP hasta 15 MB).` : ""}`);
    } catch (error) {
      created.forEach((photo) => URL.revokeObjectURL(photo.preview));
      setNotice(error instanceof Error ? error.message : "No se pudieron analizar las imágenes.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const movePhoto = (photoId: string, destinationId: string) => {
    setDrafts((current) => current
      .map((draft) => ({ ...draft, photoIds: draft.photoIds.filter((id) => id !== photoId) }))
      .filter((draft) => draft.photoIds.length > 0)
      .map((draft) => draft.id === destinationId ? { ...draft, photoIds: [...draft.photoIds, photoId] } : draft));
  };

  const separatePhoto = (photoId: string) => {
    const photo = photos.find((item) => item.id === photoId);
    if (!photo) return;
    setDrafts((current) => [...current.map((draft) => ({ ...draft, photoIds: draft.photoIds.filter((id) => id !== photoId) })).filter((draft) => draft.photoIds.length > 0), draftFromPhotos([photo])]);
  };

  const removePhoto = (photoId: string) => {
    const photo = photos.find((item) => item.id === photoId);
    if (photo) URL.revokeObjectURL(photo.preview);
    setPhotos((current) => current.filter((item) => item.id !== photoId));
    setDrafts((current) => current.map((draft) => ({ ...draft, photoIds: draft.photoIds.filter((id) => id !== photoId) })).filter((draft) => draft.photoIds.length > 0));
  };

  const exportCatalog = async () => {
    const references = drafts.map((draft) => draft.reference.trim());
    if (drafts.some((draft) => !draft.name.trim() || !draft.reference.trim() || !draft.photoIds.length) || new Set(references).size !== references.length) {
      setNotice("Cada producto necesita nombre, referencia única y al menos una foto.");
      return;
    }
    setBusy(true);
    try {
      const output = await Promise.all(drafts.map(async (draft) => ({
        name: draft.name.trim(),
        reference: draft.reference.trim(),
        brand: draft.brand.trim() || "501",
        category: draft.category,
        gender: draft.gender,
        minimum: Math.max(1, Number(draft.minimum) || 1),
        sizes: draft.sizes.split(",").map((value) => value.trim()).filter(Boolean),
        colors: draft.colors.split(",").map((value) => value.trim()).filter(Boolean),
        description: draft.description.trim(),
        badge: draft.badge,
        images: await Promise.all(draft.photoIds.map(async (id) => {
          const photo = photos.find((item) => item.id === id)!;
          const blob = await optimizedImage(photo.file);
          const data = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(new Error("No se pudo leer la foto."));
            reader.readAsDataURL(blob);
          });
          return { name: photo.file.name, data };
        })),
      })));
      const url = URL.createObjectURL(new Blob([JSON.stringify({ version: 1, products: output })], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `catalogo-501-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setNotice("Archivo descargado. Para publicarlo, usa el comando indicado en README.md.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo exportar el catálogo.");
    } finally {
      setBusy(false);
    }
  };

  const publishCatalog = async () => {
    const references = drafts.map((draft) => draft.reference.trim());
    if (drafts.some((draft) => !draft.name.trim() || !/^[a-zA-Z0-9_-]{2,60}$/.test(draft.reference.trim()) || !draft.photoIds.length) || new Set(references).size !== references.length) {
      setNotice("Cada producto necesita nombre, referencia única (letras, números o guiones) y al menos una foto.");
      return;
    }
    setBusy(true);
    try {
      const photoIds = [...new Set(drafts.flatMap((draft) => draft.photoIds))];
      for (const [index, id] of photoIds.entries()) {
        if (uploadedIds.current.has(id)) continue;
        const photo = photos.find((item) => item.id === id);
        if (!photo) throw new Error("Falta una foto del lote.");
        setNotice(`Subiendo foto ${index + 1} de ${photoIds.length}…`);
        const image = await optimizedImage(photo.file);
        const response = await adminRequest(password, "upload", { method: "POST", body: image, headers: { "Content-Type": image.type } });
        const result = await response.json() as { id: string };
        uploadedIds.current.set(id, result.id);
      }
      setNotice("Publicando productos…");
      const payload = { products: drafts.map((draft) => ({
        name: draft.name.trim(),
        reference: draft.reference.trim(),
        brand: draft.brand.trim() || "501",
        category: draft.category,
        gender: draft.gender,
        minimum: Math.max(1, Number(draft.minimum) || 1),
        sizes: draft.sizes.split(",").map((value) => value.trim()).filter(Boolean),
        colors: draft.colors.split(",").map((value) => value.trim()).filter(Boolean),
        description: draft.description.trim(),
        badge: draft.badge,
        imageIds: draft.photoIds.map((id) => uploadedIds.current.get(id)),
      })) };
      const response = await adminRequest(password, "publish", { method: "POST", body: JSON.stringify(payload), headers: { "Content-Type": "application/json" } });
      const result = await response.json() as { count: number };
      setNotice(`${result.count} productos publicados. Ya puedes verlos en el catálogo.`);
      setPublishedRevision((current) => current + 1);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo publicar el catálogo.");
    } finally {
      setBusy(false);
    }
  };

  if (!authenticated) return <main className="admin-login-screen"><div className="admin-login-card"><a href="/" className="admin-login-card__back"><ArrowLeft size={16} /> Volver a la tienda</a><div className="admin-login-card__brand">501<span>.</span></div><span className="admin-kicker">ACCESO AL PANEL</span><h1>Administrador</h1><p>Ingresa para gestionar productos, fotos y promociones.</p><form className="bulk-login" onSubmit={(event) => void login(event)}><label>Clave de administrador<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label><button type="submit" disabled={busy}>Ingresar</button></form>{notice && <p className="bulk-notice" role="status">{notice}</p>}</div></main>;

  const navigation = [
    { id: "overview" as const, label: "Resumen", icon: LayoutDashboard },
    { id: "products" as const, label: "Productos", icon: Package },
    { id: "upload" as const, label: "Agregar productos", icon: ImagePlus },
    { id: "promotions" as const, label: "Promociones", icon: Megaphone },
  ];
  const sectionTitle = navigation.find((item) => item.id === section)?.label || "Resumen";
  const navigateAdmin = (next: AdminSection) => { setSection(next); setSidebarOpen(false); window.scrollTo({ top: 0, behavior: "auto" }); };

  return <main className="admin-shell">
    {sidebarOpen && <button type="button" className="admin-sidebar-scrim" onClick={() => setSidebarOpen(false)} aria-label="Cerrar menú" />}
    <aside className={`admin-sidebar ${sidebarOpen ? "admin-sidebar--open" : ""}`}>
      <div className="admin-sidebar__brand"><span>501<b>.</b></span><small>ADMIN STUDIO</small><button type="button" onClick={() => setSidebarOpen(false)} aria-label="Cerrar menú"><X size={19} /></button></div>
      <div className="admin-sidebar__group"><span>ESPACIO DE TRABAJO</span><nav aria-label="Navegación del administrador">{navigation.map((item) => <button type="button" key={item.id} className={section === item.id ? "active" : ""} onClick={() => navigateAdmin(item.id)}><item.icon size={18} /> {item.label}</button>)}</nav></div>
      <div className="admin-sidebar__bottom"><div className="admin-sidebar__help"><strong>Tu catálogo, a tu ritmo.</strong><p>Actualiza la vitrina cuando quieras. Los cambios publicados se reflejan sin otro despliegue.</p></div><a href="/" target="_blank" rel="noreferrer"><ExternalLink size={17} /> Ver tienda</a>{!local && <button type="button" onClick={logout}><LogOut size={17} /> Cerrar sesión</button>}</div>
    </aside>
    <div className="admin-main"><header className="admin-topbar"><div><button type="button" className="admin-topbar__menu" onClick={() => setSidebarOpen(true)} aria-label="Abrir menú"><Menu size={21} /></button><span>Administrador</span><span className="admin-topbar__divider">/</span><strong>{sectionTitle}</strong></div><a href="/" target="_blank" rel="noreferrer">Ver tienda <ExternalLink size={15} /></a></header>
      <div className="admin-main__content">
        {section === "overview" && <AdminOverview password={password} revision={publishedRevision} onNavigate={navigateAdmin} />}
        {section === "products" && <PublishedProducts password={password} revision={publishedRevision} />}
        {section === "promotions" && <PromotionsManager password={password} />}
        {section === "upload" && <section className="bulk-admin admin-upload"><div className="container bulk-admin__content"><div className="admin-section-heading"><div><span className="admin-kicker">CREACIÓN DE CATÁLOGO</span><h1>Agregar productos</h1><p>Sube una o varias fotos para crear uno o varios productos. Revisa los grupos sugeridos antes de publicarlos.</p></div></div>
      <label className="bulk-dropzone" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void addFiles(event.dataTransfer.files); }}>
        <ImagePlus size={34} />
        <strong>{busy ? "Procesando imágenes…" : "Arrastra fotos o selecciónalas aquí"}</strong>
        <small>JPG, PNG o WebP · hasta 15 MB por foto · se reducen y guardan como WebP</small>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy} onChange={(event) => void addFiles(event.target.files)} />
      </label>
      {notice && <p className="bulk-notice" role="status">{notice}</p>}
      {drafts.length > 0 && <>
        <div className="bulk-summary"><strong>{drafts.length} productos sugeridos · {photos.length} fotos</strong><div className="bulk-summary__actions"><button type="button" className="bulk-export" disabled={busy} onClick={() => void exportCatalog()}><Download size={17} /> Descargar respaldo</button><button type="button" disabled={busy} onClick={() => void publishCatalog()}><UploadCloud size={17} /> Publicar productos</button></div></div>
        <p className="bulk-publish-note">Al publicar, los productos aparecerán en la tienda sin volver a desplegar el sitio.</p>
        <div className="bulk-groups">{drafts.map((draft, index) => <section className="bulk-group" key={draft.id}>
          <div className="bulk-group__head"><h2>Producto {index + 1}</h2><span>{draft.photoIds.length} foto{draft.photoIds.length === 1 ? "" : "s"}</span></div>
          <div className="bulk-photos">{draft.photoIds.map((id, photoIndex) => {
            const photo = photos.find((item) => item.id === id);
            if (!photo) return null;
            return <div className="bulk-photo" key={id}>
              <img src={photo.preview} alt={photo.file.name} />
              <small>{photoIndex === 0 ? "Portada · " : ""}{photo.file.name}</small>
              <div className="bulk-photo__actions">
                {photoIndex > 0 && <button type="button" onClick={() => updateDraft(draft.id, { photoIds: [id, ...draft.photoIds.filter((item) => item !== id)] })}>Portada</button>}
                {draft.photoIds.length > 1 && <button type="button" onClick={() => separatePhoto(id)} title="Crear producto aparte"><Scissors size={15} /></button>}
                <button type="button" onClick={() => removePhoto(id)} title="Quitar foto"><Trash2 size={15} /></button>
              </div>
              {drafts.length > 1 && <select aria-label={`Mover ${photo.file.name} a otro producto`} value="" onChange={(event) => movePhoto(id, event.target.value)}><option value="">Mover a…</option>{drafts.filter((other) => other.id !== draft.id).map((other, otherIndex) => <option value={other.id} key={other.id}>Producto {otherIndex + 1}: {other.name}</option>)}</select>}
            </div>;
          })}</div>
          <div className="bulk-fields">
            <label>Nombre<input value={draft.name} onChange={(event) => updateDraft(draft.id, { name: event.target.value })} /></label>
            <label>Referencia única<input value={draft.reference} onChange={(event) => updateDraft(draft.id, { reference: event.target.value })} placeholder="Ej. 501-JR39" /></label>
            <label>Marca<input value={draft.brand} onChange={(event) => updateDraft(draft.id, { brand: event.target.value })} /></label>
            <label>Categoría<select value={draft.category} onChange={(event) => updateDraft(draft.id, { category: event.target.value as Category })}>{categories.map((item) => <option key={item.name}>{item.name}</option>)}</select></label>
            <label>Para<select value={draft.gender} onChange={(event) => updateDraft(draft.id, { gender: event.target.value as Gender })}><option>Mujer</option><option>Hombre</option><option>Unisex</option></select></label>
            <label>Mínimo mayorista<input type="number" min="1" value={draft.minimum} onChange={(event) => updateDraft(draft.id, { minimum: Number(event.target.value) })} /></label>
            <label>Tallas, separadas por coma<input value={draft.sizes} onChange={(event) => updateDraft(draft.id, { sizes: event.target.value })} placeholder="6, 8, 10, 12" /></label>
            <label>Colores, separados por coma<input value={draft.colors} onChange={(event) => updateDraft(draft.id, { colors: event.target.value })} placeholder="Azul, Negro" /></label>
            <label>Etiqueta en la tienda<select value={draft.badge} onChange={(event) => updateDraft(draft.id, { badge: event.target.value })}><option value="">Sin etiqueta</option><option>Nuevo</option><option>Destacado</option><option>Top ventas</option><option>Exclusivo</option><option>Pocas unidades</option></select></label>
            <label className="bulk-fields__wide">Descripción<textarea value={draft.description} onChange={(event) => updateDraft(draft.id, { description: event.target.value })} rows={2} /></label>
          </div>
        </section>)}</div>
      </>}
      <p className="bulk-admin__hint"><Merge size={16} /> Si dos grupos son el mismo producto, mueve sus fotos con el selector “Mover a…”. También puedes separar una foto con el icono de tijeras.</p>
      </div></section>}
      </div>
    </div>
  </main>;
}
