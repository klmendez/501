import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  Facebook,
  Heart,
  Home,
  Instagram,
  MapPin,
  Menu,
  MessageCircle,
  Minus,
  PackageCheck,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Store,
  Truck,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import BulkUpload from "./BulkUpload";
import { categories, products, type Category, type Product } from "./data";
import { WHATSAPP_PHONE } from "./config";
import type { Promotion } from "./promotions";

type Mode = "retail" | "wholesale";
type CartItem = { productId: number; size: string; color: string; quantity: number };
type Cart = Record<string, CartItem>;
type ZoomLens = { x: number; y: number; width: number; height: number; left: number; top: number; size: number };

const LENS_SCALE = 2.5;
const heroPhotos = ["DSC01261", "DSC01273", "DSC01282", "DSC01404", "DSC01412", "DSC01423", "DSC01427"];
const brandLogoFiles: Record<string, string> = {
  "Levi's": "levis.svg",
  Superdry: "superdry.svg",
  BOSS: "boss.svg",
  "Carolina Herrera": "carolinaherrera.svg",
  Diesel: "diesel.svg",
  Columbia: "columbia.svg",
  "The North Face": "thenorthface.svg",
  Abercrombie: "abercrombie.svg",
};
const socialLinks = [
  { name: "Instagram", handle: "@almacen.501", href: "https://www.instagram.com/almacen.501/", icon: Instagram },
  { name: "TikTok", handle: "@almacen501", href: "https://www.tiktok.com/@almacen501", icon: null },
  { name: "Facebook", handle: "Almacén 501", href: "https://www.facebook.com/profile.php?id=61585976413461", icon: Facebook },
];
const isModelPhoto = (product: Product) => /^501-FOTO-/i.test(product.reference) || /-modelo\.[a-z0-9]+(?:\?|$)/i.test(product.image);
const slugify = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function SocialLinks({ compact = false }: { compact?: boolean }) {
  return <div className={`social-links ${compact ? "social-links--compact" : ""}`}>
    {socialLinks.map(({ name, href, icon: Icon }) => <a href={href} key={name} target="_blank" rel="noopener noreferrer" aria-label={`501 en ${name}`}>
      <span className="social-links__icon">{Icon ? <Icon size={compact ? 18 : 22} strokeWidth={1.8} /> : <img src="/tiktok.svg" alt="" width={compact ? 18 : 22} height={compact ? 18 : 22} />}</span>
      {!compact && <span className="social-links__label"><strong>{name}</strong></span>}
      {!compact && <ArrowRight size={18} className="social-links__arrow" />}
    </a>)}
  </div>;
}

function BrandLogo({ name }: { name: string }) {
  const file = brandLogoFiles[name];
  return file
    ? <img className="brand-logo__image" src={`/brands/${file}`} alt="" loading="lazy" />
    : <span className="brand-logo__mark" aria-hidden="true">{name}</span>;
}

function HeroSlide({ index, previous = false }: { index: number; previous?: boolean }) {
  const first = heroPhotos[index].toLowerCase();
  const second = heroPhotos[(index + 1) % heroPhotos.length].toLowerCase();
  return <div className={`hero__slide hero__slide--${previous ? "previous" : "current"}`} aria-hidden={previous}>
    <picture className="hero__photo hero__photo--first">
      <source media="(max-width: 760px)" srcSet={`/hero/${first}-mobile.webp`} />
      <img className="hero__image" src={`/hero/${first}.webp`} alt={previous ? "" : "Moda urbana de 501"} fetchPriority={index === 0 && !previous ? "high" : "auto"} />
    </picture>
    <div className="hero__photo hero__photo--second" style={{ backgroundImage: `url(/hero/${second}.webp)` }} />
  </div>;
}

function ProductImageZoom({ src, alt, onOpen }: { src: string; alt: string; onOpen: () => void }) {
  const [lens, setLens] = useState<ZoomLens | null>(null);

  const moveLens = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
    const size = Math.min(190, rect.width, rect.height);
    setLens({
      x, y, width: rect.width, height: rect.height, size,
      left: Math.max(0, Math.min(rect.width - size, x - size / 2)),
      top: Math.max(0, Math.min(rect.height - size, y - size / 2)),
    });
  };

  return (
    <div className="product-image-zoom" onPointerMove={moveLens} onPointerLeave={() => setLens(null)}>
      <img src={src} alt={alt} onClick={() => { if (window.matchMedia("(hover: none)").matches) onOpen(); }} />
      {lens && <div className="product-image-zoom__lens" aria-hidden="true" style={{ width: lens.size, height: lens.size, left: lens.left, top: lens.top }}>
        <img src={src} alt="" style={{ width: lens.width * LENS_SCALE, height: lens.height * LENS_SCALE, left: lens.x - lens.left - lens.x * LENS_SCALE, top: lens.y - lens.top - lens.y * LENS_SCALE }} />
      </div>}
    </div>
  );
}

const genders = ["Todos", "Mujer", "Hombre", "Unisex"];

function whatsappLink(message: string) {
  return `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(message)}`;
}

function productLink(product: Product) {
  return `${window.location.origin}/catalogo?producto=${encodeURIComponent(product.reference)}`;
}

function productMessage(product: Product, mode: Mode, size?: string, color?: string) {
  const details = [size && `talla ${size}`, color && `color ${color}`].filter(Boolean).join(", ");
  if (mode === "wholesale") return `Hola, soy mayorista y quiero saber el precio de este producto al por mayor: ${product.name} (ref. ${product.reference})${details ? `, ${details}` : ""}. ¿Me confirmas disponibilidad y pedido mínimo?\n${productLink(product)}`;
  return `Hola, quiero saber el precio de este producto: ${product.name} (ref. ${product.reference})${details ? `, ${details}` : ""}.\n${productLink(product)}`;
}

function carouselStep(viewport: HTMLDivElement) {
  const first = viewport.querySelector<HTMLElement>("[data-carousel-set] > *");
  const next = first?.nextElementSibling as HTMLElement | null;
  return first && next ? next.offsetLeft - first.offsetLeft : first?.offsetWidth ?? 0;
}

function useAutoCarousel(itemCount: number, intervalMs: number, active: boolean, spotlight = false) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const viewport = ref.current;
    if (!viewport || itemCount < 2 || !active) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;
    let paused = false;
    let centered: HTMLElement | null = null;
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }, { threshold: 0.1 });
    observer.observe(viewport);
    const pause = () => { paused = true; };
    const resume = () => { paused = false; };
    const updateSpotlight = () => {
      const center = viewport.getBoundingClientRect().left + viewport.clientWidth / 2;
      let nearest: HTMLElement | null = null;
      let distance = Infinity;
      for (const card of viewport.querySelectorAll<HTMLElement>(".category-card")) {
        const rect = card.getBoundingClientRect();
        const gap = Math.abs(rect.left + rect.width / 2 - center);
        if (gap < distance) { nearest = card; distance = gap; }
      }
      if (nearest !== centered) {
        centered?.classList.remove("is-centered");
        centered = nearest;
        centered?.classList.add("is-centered");
      }
    };
    const advance = () => {
      const first = viewport.querySelector<HTMLElement>("[data-carousel-set]");
      const second = first?.nextElementSibling as HTMLElement | null;
      const loopWidth = first && second ? second.offsetLeft - first.offsetLeft : 0;
      if (!visible || paused || motion.matches || performance.now() < Number(viewport.dataset.manualPauseUntil || 0) || !loopWidth) return;
      if (viewport.scrollLeft >= loopWidth - 1) viewport.scrollLeft -= loopWidth;
      viewport.scrollBy({ left: carouselStep(viewport), behavior: "smooth" });
    };
    viewport.addEventListener("pointerenter", pause);
    viewport.addEventListener("pointerleave", resume);
    viewport.addEventListener("focusin", pause);
    viewport.addEventListener("focusout", resume);
    const autoTimer = window.setInterval(advance, intervalMs);
    const spotlightTimer = spotlight ? window.setInterval(() => { if (visible) updateSpotlight(); }, 120) : null;
    return () => {
      window.clearInterval(autoTimer);
      if (spotlightTimer) window.clearInterval(spotlightTimer);
      observer.disconnect();
      viewport.removeEventListener("pointerenter", pause);
      viewport.removeEventListener("pointerleave", resume);
      viewport.removeEventListener("focusin", pause);
      viewport.removeEventListener("focusout", resume);
      centered?.classList.remove("is-centered");
    };
  }, [itemCount, intervalMs, active, spotlight]);

  return ref;
}

function moveCarousel(viewport: HTMLDivElement | null, direction: -1 | 1) {
  if (!viewport) return;
  const first = viewport.querySelector<HTMLElement>("[data-carousel-set]");
  const second = first?.nextElementSibling as HTMLElement | null;
  const loopWidth = first && second ? second.offsetLeft - first.offsetLeft : 0;
  const distance = carouselStep(viewport);
  if (direction < 0 && loopWidth && viewport.scrollLeft < distance) viewport.scrollLeft += loopWidth;
  viewport.dataset.manualPauseUntil = String(performance.now() + 2800);
  viewport.scrollBy({ left: distance * direction, behavior: "smooth" });
}

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [catalogProducts, setCatalogProducts] = useState<Product[]>(products);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [category, setCategory] = useState<"Todos" | Category>("Todos");
  const [brand, setBrand] = useState("Todas");
  const [gender, setGender] = useState("Todos");
  const [size, setSize] = useState("Todas");
  const [color, setColor] = useState("Todos");
  const [menuOpen, setMenuOpen] = useState(false);
  const [openNavMenu, setOpenNavMenu] = useState<"categorias" | "marcas" | null>(null);
  const [mobileNavSection, setMobileNavSection] = useState<"categorias" | "marcas" | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [zoomedProduct, setZoomedProduct] = useState<Product | null>(null);
  const [zoomScale, setZoomScale] = useState(1);
  const [favorites, setFavorites] = useState<Set<number>>(new Set());
  const [cart, setCart] = useState<Cart>({});
  const [toast, setToast] = useState("");
  const [heroSlide, setHeroSlide] = useState<{ index: number; previous: number | null }>({ index: 0, previous: null });
  const searchRef = useRef<HTMLInputElement>(null);
  const brands = useMemo(() => ["Todas", ...Array.from(new Set(catalogProducts.map((product) => product.brand)))], [catalogProducts]);
  const sizes = useMemo(() => ["Todas", ...Array.from(new Set(catalogProducts.flatMap((product) => product.sizes)))], [catalogProducts]);
  const colors = useMemo(() => ["Todos", ...Array.from(new Set(catalogProducts.flatMap((product) => product.colors)))], [catalogProducts]);
  const homeProducts: Product[] = [];
  for (const featuredCategory of ["Jeans", "Chaquetas", "Conjuntos", "Camisetas"] as Category[]) {
    const product = catalogProducts.find((item) => item.category === featuredCategory);
    if (product) homeProducts.push(product);
  }
  for (const product of catalogProducts) {
    if (homeProducts.length >= 4) break;
    if (!homeProducts.some((item) => item.reference === product.reference)) homeProducts.push(product);
  }
  const visibleCategories = categories.filter((item) => catalogProducts.some((product) => product.category === item.name)).map((item) => {
    const representative = catalogProducts.find((product) => product.reference === item.reference)
      ?? catalogProducts.find((product) => product.category === item.name);
    return { ...item, image: representative?.image ?? item.image, modelImage: representative ? isModelPhoto(representative) : true };
  });
  const featuredBrands = brands.slice(1).filter((item) => item !== "Sin marca identificada");
  const logoBrands = featuredBrands.filter((name) => name in brandLogoFiles);
  const carouselBrands = logoBrands.length > 0 ? logoBrands : featuredBrands;
  const campaignItems = promotions.filter((promotion) => promotion.active).map((promotion) => ({ promotion, product: catalogProducts.find((item) => item.reference === promotion.productReference) })).filter((item): item is { promotion: Promotion; product: Product } => Boolean(item.product));
  const bannerCampaign = campaignItems.find((item) => item.promotion.placement === "banner");
  const featuredCampaigns = campaignItems.filter((item) => item.promotion.placement === "destacado");
  const page = location.pathname === "/catalogo" ? "catalogo"
    : location.pathname === "/categorias" ? "categorias"
      : location.pathname.startsWith("/categorias/") ? "categoria"
        : location.pathname === "/marcas" ? "marcas"
          : location.pathname.startsWith("/marcas/") ? "marca"
            : location.pathname === "/contacto" ? "contacto"
              : location.pathname === "/admin" ? "admin"
                : "inicio";
  const routeCategory = page === "categoria" ? categories.find((item) => slugify(item.name) === location.pathname.split("/")[2]) : undefined;
  const routeBrand = page === "marca" ? featuredBrands.find((name) => slugify(name) === location.pathname.split("/")[2]) : undefined;
  const categoryCarousel = useAutoCarousel(visibleCategories.length, 6000, page === "inicio", true);
  const brandCarousel = useAutoCarousel(carouselBrands.length, 4800, page === "inicio");

  useEffect(() => {
    if (page !== "inicio" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setHeroSlide(({ index }) => ({
      index: (index + (window.matchMedia("(max-width: 760px)").matches ? 1 : 2)) % heroPhotos.length,
      previous: index,
    })), 5000);
    return () => window.clearInterval(timer);
  }, [page]);

  useEffect(() => {
    if (page !== "inicio") return;
    const mobile = window.matchMedia("(max-width: 760px)").matches;
    const nextIndex = (heroSlide.index + (mobile ? 1 : 2)) % heroPhotos.length;
    const upcoming = mobile ? [nextIndex] : [nextIndex, (nextIndex + 1) % heroPhotos.length];
    for (const index of upcoming) {
      const image = new Image();
      image.src = `/hero/${heroPhotos[index].toLowerCase()}${mobile ? "-mobile" : ""}.webp`;
    }
  }, [heroSlide.index, page]);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return catalogProducts.filter((product) => {
      const matchesSearch = !query || [product.name, product.brand, product.reference, product.category]
        .join(" ")
        .toLowerCase()
        .includes(query);
      if (page === "categoria") return matchesSearch && product.category === routeCategory?.name;
      if (page === "marca") return matchesSearch && product.brand === routeBrand;
      return matchesSearch
        && (category === "Todos" || product.category === category)
        && (brand === "Todas" || product.brand === brand)
        && (gender === "Todos" || product.gender === gender)
        && (size === "Todas" || product.sizes.includes(size))
        && (color === "Todos" || product.colors.includes(color));
    });
  }, [brand, catalogProducts, category, color, gender, page, routeBrand, routeCategory?.name, search, size]);

  useEffect(() => {
    const loadCatalog = async () => {
      try {
        const live = await fetch("/.netlify/functions/catalog", { cache: "no-store" });
        if (live.ok) {
          const result = await live.json();
          if (Array.isArray(result)) return result as Product[];
        }
      } catch { /* El servidor local de Vite no incluye funciones de Netlify. */ }
      const fallback = await fetch("/catalog-products.json", { cache: "no-store" });
      return fallback.ok ? await fallback.json() as Product[] : [];
    };
    loadCatalog()
      .then((uploaded: Product[]) => {
        if (!Array.isArray(uploaded)) return;
        const references = new Set(uploaded.map((product) => product.reference));
        setCatalogProducts([...uploaded, ...products.filter((product) => !references.has(product.reference))]);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/.netlify/functions/promotions", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : [])
      .then((items: Promotion[]) => setPromotions(Array.isArray(items) ? items : []))
      .catch(() => {});
  }, []);

  const activeExtraFilters = [brand !== "Todas", gender !== "Todos", size !== "Todas", color !== "Todos"].filter(Boolean).length;

  const cartCount = Object.values(cart).reduce((sum, item) => sum + item.quantity, 0);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const isLocked = menuOpen || filtersOpen || cartOpen || Boolean(selectedProduct) || Boolean(zoomedProduct);
    document.body.style.overflow = isLocked ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [cartOpen, filtersOpen, menuOpen, selectedProduct, zoomedProduct]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
    setMenuOpen(false);
    setOpenNavMenu(null);
  }, [location.pathname]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const reference = params.get("producto");
    const product = catalogProducts.find((item) => item.reference === reference);
    if (product) {
      setSelectedProduct(product);
      setSelectedImage(0);
      setSelectedSize(product.sizes[0] || "");
      setSelectedColor(product.colors[0] || "");
    }
  }, [catalogProducts, location.search]);

  const goPage = (path: string) => { setOpenNavMenu(null); setMenuOpen(false); navigate(path); };
  const openCatalog = () => { setCategory("Todos"); setBrand("Todas"); setGender("Todos"); setSize("Todas"); setColor("Todos"); setSearch(""); goPage("/catalogo"); };
  const openCategory = (name: Category) => { setSearch(""); goPage(`/categorias/${slugify(name)}`); };
  const openBrand = (name: string) => { setSearch(""); goPage(`/marcas/${slugify(name)}`); };
  const goTo = (id: string) => {
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const chooseCategory = openCategory;

  const toggleFavorite = (id: number) => {
    setFavorites((current) => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const openProduct = (product: Product) => {
    setSelectedProduct(product);
    setSelectedImage(0);
    setSelectedSize(product.sizes[0] || "");
    setSelectedColor(product.colors[0] || "");
  };

  const addToCart = (product: Product, size: string, color: string) => {
    if (product.sizes.length && !size) {
      setToast("Elige una talla");
      return;
    }
    const key = `${product.id}::${size}::${color}`;
    setCart((current) => ({
      ...current,
      [key]: current[key]
        ? { ...current[key], quantity: current[key].quantity + 1 }
        : { productId: product.id, size, color, quantity: 1 },
    }));
    setToast(`${product.name}${size ? ` · talla ${size}` : ""}`);
  };

  const updateQuantity = (key: string, delta: number) => {
    setCart((current) => {
      const next = { ...current };
      const quantity = next[key].quantity + delta;
      if (quantity <= 0) delete next[key];
      else next[key] = { ...next[key], quantity };
      return next;
    });
  };

  const focusSearch = () => {
    setSearchOpen(true);
    goPage("/catalogo");
    window.setTimeout(() => searchRef.current?.focus(), 500);
  };

  const cartMessage = useMemo(() => {
    const lines = Object.values(cart).map((item) => {
      const product = catalogProducts.find((productItem) => productItem.id === item.productId);
      return product ? `• ${item.quantity} x ${product.name} (${product.reference})${item.size ? ` — talla ${item.size}` : ""}, ${item.color}\n${productLink(product)}` : "";
    }).filter(Boolean);
    return [
      "Hola, quiero cotizar este pedido:",
      ...lines,
      "¿Me confirman disponibilidad, tallas y colores?",
    ].join("\n");
  }, [cart, catalogProducts]);

  if (page === "admin") return <BulkUpload />;

  return (
    <div className="site-shell">
      <div className="announcement">
        <span>Envíos a toda Colombia</span>
        <span className="announcement__dot" />
        <span>Atención por WhatsApp</span>
      </div>

      <header className="header">
        <div className="header__inner container">
          <button className="icon-button mobile-only" onClick={() => setMenuOpen(true)} aria-label="Abrir menú">
            <Menu size={23} />
          </button>
          <button className="brand" onClick={() => goPage("/")} aria-label="Ir al inicio">
            <span className="brand__number">501</span>
            <span className="brand__label">DENIM & STYLE</span>
          </button>

          <nav className="desktop-nav" aria-label="Navegación principal">
            <button className={page === "inicio" ? "active" : ""} onClick={() => goPage("/")}>Inicio</button>
            <div className="desktop-nav__group" onMouseEnter={() => setOpenNavMenu("categorias")} onMouseLeave={() => setOpenNavMenu(null)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpenNavMenu(null); }}>
              <button className={page === "categorias" || page === "categoria" ? "active" : ""} onClick={() => setOpenNavMenu(openNavMenu === "categorias" ? null : "categorias")} aria-expanded={openNavMenu === "categorias"}>Categorías <ChevronDown size={14} /></button>
              {openNavMenu === "categorias" && <div className="desktop-nav__submenu">
                <button onClick={() => goPage("/categorias")}>Ver todas las categorías <ArrowRight size={15} /></button>
                {visibleCategories.map((item) => <button key={item.name} onClick={() => openCategory(item.name)}>{item.name}<span>{catalogProducts.filter((product) => product.category === item.name).length}</span></button>)}
              </div>}
            </div>
            <div className="desktop-nav__group" onMouseEnter={() => setOpenNavMenu("marcas")} onMouseLeave={() => setOpenNavMenu(null)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpenNavMenu(null); }}>
              <button className={page === "marcas" || page === "marca" ? "active" : ""} onClick={() => setOpenNavMenu(openNavMenu === "marcas" ? null : "marcas")} aria-expanded={openNavMenu === "marcas"}>Marcas <ChevronDown size={14} /></button>
              {openNavMenu === "marcas" && <div className="desktop-nav__submenu desktop-nav__submenu--brands">
                <button onClick={() => goPage("/marcas")}>Ver todas las marcas <ArrowRight size={15} /></button>
                {featuredBrands.map((name) => <button key={name} onClick={() => openBrand(name)}>{name}<span>{catalogProducts.filter((product) => product.brand === name).length}</span></button>)}
              </div>}
            </div>
            <button className={page === "catalogo" ? "active" : ""} onClick={openCatalog}>Catálogo</button>
            <button className={page === "contacto" ? "active" : ""} onClick={() => goPage("/contacto")}>Contacto</button>
          </nav>

          <div className="header__actions">
            <button className="icon-button mobile-only" onClick={focusSearch} aria-label="Buscar productos"><Search size={20} /></button>
            <button className="icon-button desktop-search" onClick={focusSearch} aria-label="Buscar">
              <Search size={20} />
            </button>
            <button className="icon-button favorite-header" onClick={() => { goPage("/catalogo"); setToast(`${favorites.size} favorito${favorites.size === 1 ? "" : "s"} guardado${favorites.size === 1 ? "" : "s"}`); }} aria-label="Favoritos">
              <Heart size={20} />
              {favorites.size > 0 && <span className="count-badge">{favorites.size}</span>}
            </button>
            <button className="cart-button" onClick={() => setCartOpen(true)} aria-label={`Bolsa con ${cartCount} productos`}>
              <ShoppingBag size={20} />
              <span className="cart-button__label">Mi pedido</span>
              {cartCount > 0 && <span className="count-badge">{cartCount}</span>}
            </button>
          </div>
        </div>
      </header>

      <main>
        {page === "inicio" && <>
        <section className="hero hero--home" id="inicio">
          {heroSlide.previous !== null && <HeroSlide index={heroSlide.previous} previous key={`previous-${heroSlide.previous}`} />}
          <HeroSlide index={heroSlide.index} key={`current-${heroSlide.index}`} />
          <div className="hero__shade" />
          <div className="hero__content container">
            <div className="hero__copy">
              <div className="hero__eyebrow"><Sparkles size={15} /> Nueva colección 2026</div>
              <h1>Denim para<br /><em>tu ritmo.</em></h1>
              <p>Jeans, bermudas, chaquetas, buzos y conjuntos de nuestro catálogo. Explora las prendas sobre modelo y compara cada foto real.</p>
              <div className="hero__buttons">
                <button className="button button--red" onClick={openCatalog}>
                  Ver catálogo <ArrowRight size={18} />
                </button>
                <button className="button button--glass" onClick={() => goPage("/categorias")}>
                  Explorar categorías
                </button>
              </div>
              <div className="hero__proof">
                <span><Check size={15} /> Compra fácil</span>
                <span><Check size={15} /> Atención por WhatsApp</span>
              </div>
            </div>
          </div>
          <button className="hero__scroll" onClick={() => goTo("categorias")} aria-label="Ver categorías">
            Descubre <ChevronDown size={18} />
          </button>
        </section>

        {bannerCampaign && <section className="store-campaign-banner" style={{ backgroundImage: `linear-gradient(90deg, rgba(9,9,11,.96), rgba(9,9,11,.68) 50%, rgba(9,9,11,.12)), url(${bannerCampaign.product.image})` }}><div className="container"><span>{bannerCampaign.promotion.label || "SELECCIÓN 501"}</span><h2>{bannerCampaign.promotion.title}</h2><p>{bannerCampaign.promotion.description || bannerCampaign.product.name}</p><button type="button" onClick={() => openProduct(bannerCampaign.product)}>Ver producto <ArrowRight size={17} /></button></div></section>}

        {featuredCampaigns.length > 0 && <section className="section store-campaign-featured"><div className="container"><div className="section-heading"><div><span className="section-kicker">Elegidos para ti</span><h2>En primer plano</h2></div></div><div className="store-campaign-featured__grid">{featuredCampaigns.slice(0, 3).map(({ promotion, product }) => <button type="button" key={promotion.id} onClick={() => openProduct(product)}><img src={product.image} alt="" loading="lazy" /><div><span>{promotion.label || "DESTACADO"}</span><h3>{promotion.title}</h3><p>{promotion.description || product.name}</p><strong>Ver producto <ArrowRight size={15} /></strong></div></button>)}</div></div></section>}

        <section className="section categories-section" id="categorias">
          <div className="container">
            <div className="section-heading">
              <div>
                <span className="section-kicker">Encuentra lo tuyo</span>
                <h2>Compra por categoría</h2>
              </div>
              <button className="text-link" onClick={() => goPage("/categorias")}>
                Todas las categorías <ArrowRight size={17} />
              </button>
            </div>
            <div className="carousel-shell">
            <button className="carousel-arrow carousel-arrow--left" onClick={() => moveCarousel(categoryCarousel.current, -1)} aria-label="Ver categorías anteriores"><ChevronRight size={23} /></button>
            <div className="home-carousel" ref={categoryCarousel} aria-label="Categorías, carrusel automático">
              {[0, 1].map((copy) => <div className="home-carousel__set" data-carousel-set key={copy} aria-hidden={copy === 1 ? true : undefined}>
                {visibleCategories.map((item) => (
                  <button className="category-card" data-category={item.name} data-model={item.modelImage} key={item.name} tabIndex={copy === 1 ? -1 : undefined} onClick={() => chooseCategory(item.name)}>
                    <span className="category-card__media"><img src={item.image} alt="" loading="lazy" /></span>
                    <div className="category-card__content">
                      <span>{item.eyebrow}</span>
                      <h3>{item.name}</h3>
                      <small>{catalogProducts.filter((product) => product.category === item.name).length} referencias</small>
                    </div>
                    <span className="category-card__arrow"><ArrowRight size={18} /></span>
                  </button>
                ))}
              </div>)}
            </div>
            <button className="carousel-arrow carousel-arrow--right" onClick={() => moveCarousel(categoryCarousel.current, 1)} aria-label="Ver más categorías"><ChevronRight size={23} /></button>
            </div>
          </div>
        </section>

        <section className="brand-strip" aria-label="Marcas destacadas">
          <div className="container brand-strip__inner">
            <div className="brand-strip__heading">
              <div><span className="section-kicker">Marcas que encuentras</span><h2>Elige tu marca favorita</h2></div>
              <div className="brand-strip__controls">
                <button className="text-link" onClick={() => goPage("/marcas")}>Todas las marcas <ArrowRight size={17} /></button>
                <button className="brand-strip__arrow brand-strip__arrow--previous" onClick={() => moveCarousel(brandCarousel.current, -1)} aria-label="Ver marcas anteriores"><ChevronRight size={21} /></button>
                <button className="brand-strip__arrow" onClick={() => moveCarousel(brandCarousel.current, 1)} aria-label="Ver más marcas"><ChevronRight size={21} /></button>
              </div>
            </div>
            <div className="carousel-shell carousel-shell--brands">
            <div className="home-carousel home-carousel--brands" ref={brandCarousel} aria-label="Marcas, carrusel automático">
              {[0, 1].map((copy) => <div className="home-carousel__set" data-carousel-set key={copy} aria-hidden={copy === 1 ? true : undefined}>
                {carouselBrands.map((name) => <button className={`brand-logo brand-logo--${name.toLowerCase().replace(/[^a-z0-9]/g, "")}`} key={name} tabIndex={copy === 1 ? -1 : undefined} aria-label={`Ver productos ${name}`} onClick={() => openBrand(name)}>
                  <BrandLogo name={name} />
                </button>)}
              </div>)}
            </div>
            </div>
          </div>
        </section>

        <section className="home-editorial">
          <div className="container home-editorial__inner">
            <div className="home-editorial__image"><img src="/hero/dsc01412.webp" alt="Look urbano de 501 con chaqueta" loading="lazy" /></div>
            <div className="home-editorial__copy">
              <span className="section-kicker">Hecho para tu estilo</span>
              <h2>Una prenda puede cambiar todo el look.</h2>
              <p>Explora jeans, chaquetas, camisetas y conjuntos. Entra a cada categoría para encontrar solo las prendas que buscas.</p>
              <button className="button button--red" onClick={() => goPage("/categorias")}>Explorar categorías <ArrowRight size={18} /></button>
            </div>
          </div>
        </section>

        <section className="section best-sellers-section">
          <div className="container">
            <div className="section-heading">
              <div>
                <span className="section-kicker">La vitrina 501</span>
                <h2>Prendas para descubrir</h2>
              </div>
              <button className="text-link" onClick={() => { setCategory("Todos"); setBrand("Todas"); goPage("/catalogo"); }}>Ver catálogo completo <ArrowRight size={17} /></button>
            </div>
            <div className="home-products-grid">
              {homeProducts.map((product) => <ProductCard
                key={product.id}
                product={product}
                favorite={favorites.has(product.id)}
                onFavorite={() => toggleFavorite(product.id)}
                onOpen={() => openProduct(product)}
              />)}
            </div>
            <button className="button button--dark home-catalog-cta" onClick={() => goPage("/catalogo")}>Explorar todo el catálogo <ArrowRight size={18} /></button>
          </div>
        </section>
        </>}

        {page === "categorias" && <section className="section directory-page">
          <div className="container">
            <div className="directory-page__heading"><span className="section-kicker">Explora a tu manera</span><h1>Categorías</h1><p>Elige la prenda que buscas y descubre sus referencias.</p></div>
            <div className="category-directory">{visibleCategories.map((item) => <button className="category-card" data-category={item.name} data-model={item.modelImage} key={item.name} onClick={() => openCategory(item.name)}>
              <span className="category-card__media"><img src={item.image} alt="" loading="lazy" /></span><div className="category-card__content"><span>{item.eyebrow}</span><h3>{item.name}</h3><small>{catalogProducts.filter((product) => product.category === item.name).length} referencias</small></div><span className="category-card__arrow"><ArrowRight size={18} /></span>
            </button>)}</div>
          </div>
        </section>}

        {page === "marcas" && <section className="section directory-page directory-page--brands">
          <div className="container">
            <div className="directory-page__heading"><span className="section-kicker">Encuentra tu favorita</span><h1>Marcas</h1><p>Entra a una marca para ver solamente sus prendas disponibles.</p></div>
            <div className="brand-directory">{featuredBrands.map((name) => <button className={`brand-logo brand-logo--${name.toLowerCase().replace(/[^a-z0-9]/g, "")}`} key={name} aria-label={`Ver productos ${name}`} onClick={() => openBrand(name)}><BrandLogo name={name} /></button>)}</div>
          </div>
        </section>}

        {(page === "catalogo" || page === "categoria" || page === "marca") && <section className="section catalog-section" id="catalogo">
          <div className="container">
            <div className="catalog-top">
              <div>
                {(page === "categoria" || page === "marca") && <button className="catalog-back" onClick={() => goPage(page === "categoria" ? "/categorias" : "/marcas")}>← Volver a {page === "categoria" ? "categorías" : "marcas"}</button>}
                <span className="section-kicker">{page === "categoria" ? "Categoría" : page === "marca" ? "Marca" : "Catálogo 501"}</span>
                <h2>{page === "categoria" ? routeCategory?.name ?? "Categoría" : page === "marca" ? routeBrand ?? "Marca" : "Todas las prendas"}</h2>
              </div>
              {page !== "catalogo" && <button className="text-link" onClick={openCatalog}>Ver catálogo completo <ArrowRight size={17} /></button>}
            </div>

            <div className="catalog-tools">
              <label className={`search-box ${searchOpen ? "search-box--open" : ""}`}>
                <Search size={19} />
                <input ref={searchRef} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Busca prenda, marca o referencia" />
                {(search || searchOpen) && <button onClick={() => { setSearch(""); setSearchOpen(false); }} aria-label="Cerrar búsqueda"><X size={17} /></button>}
              </label>
              {page === "catalogo" && <button className="filter-trigger" onClick={() => setFiltersOpen(true)}>
                <SlidersHorizontal size={18} /> Filtrar
                {activeExtraFilters > 0 && <span className="filter-count">{activeExtraFilters}</span>}
              </button>}
              {page === "catalogo" && <div className="desktop-filters">
                <select value={brand} onChange={(event) => setBrand(event.target.value)} aria-label="Filtrar por marca">
                  {brands.map((item) => <option key={item}>{item}</option>)}
                </select>
                <select value={gender} onChange={(event) => setGender(event.target.value)} aria-label="Filtrar por género">
                  {genders.map((item) => <option key={item}>{item}</option>)}
                </select>
              </div>}
            </div>

            {page === "catalogo" && <div className="mobile-filter-chips" aria-label="Filtros rápidos">
              <button onClick={() => setFiltersOpen(true)}>{brand === "Todas" ? "Marca" : brand}<ChevronDown size={13} /></button>
              <button onClick={() => setFiltersOpen(true)}>{size === "Todas" ? "Talla" : size}<ChevronDown size={13} /></button>
              <button onClick={() => setFiltersOpen(true)}>{color === "Todos" ? "Color" : color}<ChevronDown size={13} /></button>
            </div>}

            {page !== "marca" && <div className="category-pills" aria-label="Categorías">
              {(["Todos", ...visibleCategories.map((item) => item.name)] as const).map((item) => (
                <button key={item} className={(page === "categoria" ? routeCategory?.name === item : category === item) ? "active" : ""} onClick={() => item === "Todos" ? openCatalog() : page === "categoria" ? openCategory(item) : setCategory(item)}>{item}</button>
              ))}
            </div>}

            <div className="results-line">
              <span>{filteredProducts.length} productos</span>
            </div>

            {filteredProducts.length > 0 ? (
              <div className="product-grid">
                {filteredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    favorite={favorites.has(product.id)}
                    onFavorite={() => toggleFavorite(product.id)}
                    onOpen={() => openProduct(product)}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <Search size={30} />
                <h3>No encontramos coincidencias</h3>
                <p>Prueba otra búsqueda o limpia los filtros.</p>
                <button className="button button--dark" onClick={() => { setSearch(""); setCategory("Todos"); setBrand("Todas"); setGender("Todos"); setSize("Todas"); setColor("Todos"); if (page !== "catalogo") openCatalog(); }}>Ver todos los productos</button>
              </div>
            )}
          </div>
        </section>}

        {page === "inicio" && <section className="home-service">
          <div className="container home-service__inner">
            <span className="section-kicker">Del almacén a tu ciudad</span>
            <h2>Encuentra tu prenda. Nosotros te ayudamos con el resto.</h2>
            <p>Consulta tallas, colores y disponibilidad por WhatsApp. Enviamos pedidos a toda Colombia.</p>
            <a href={whatsappLink("Hola, quiero consultar un pedido y las opciones de envío de 501.")} target="_blank" rel="noopener noreferrer">Hablar con 501 <ArrowRight size={18} /></a>
          </div>
        </section>}

        {page === "inicio" && <section className="social-section">
          <div className="container social-section__inner">
            <div className="social-section__intro">
              <span className="section-kicker">501 en redes</span>
              <h2>Síguenos. Siempre estamos sacando looks y promociones exclusivas.</h2>
              <p>Encuentra novedades, videos y prendas recién llegadas en nuestros perfiles.</p>
            </div>
            <SocialLinks />
          </div>
        </section>}

        {page === "inicio" && <section className="home-video">
          <div className="container home-video__inner">
            <div className="home-video__intro">
              <span className="section-kicker">Mira lo que pasa en 501</span>
              <h2>Un vistazo al almacén.</h2>
              <p>Te compartimos uno de nuestros videos en Instagram. Síguenos para ver lo que llega y las promociones que publicamos.</p>
              <a href="https://www.instagram.com/p/DX13_Mcg3BM/" target="_blank" rel="noopener noreferrer">Ver publicación en Instagram <ArrowRight size={18} /></a>
            </div>
            <div className="home-video__embed"><iframe title="Video de Almacén 501 en Instagram" src="https://www.instagram.com/p/DX13_Mcg3BM/embed/" loading="lazy" allow="encrypted-media; picture-in-picture" referrerPolicy="strict-origin-when-cross-origin" /></div>
          </div>
        </section>}

        {(page === "inicio" || page === "contacto") && <section className="trust-strip">
          <div className="container trust-grid">
            <div><Truck /><span><strong>Envíos nacionales</strong><small>Seguimiento de tu pedido</small></span></div>
            <div><ShieldCheck /><span><strong>Compra acompañada</strong><small>Asesoría antes de pagar</small></span></div>
            <div><PackageCheck /><span><strong>Surtido constante</strong><small>Nuevas referencias cada semana</small></span></div>
          </div>
        </section>}

        {page === "contacto" && <section className="contact-page">
          <div className="container contact-page__grid">
            <div>
              <span className="section-kicker">Estamos para ayudarte</span>
              <h1>Hablemos de<br />tu próximo pedido.</h1>
              <p>Cuéntanos qué prendas buscas y te ayudamos a confirmar tallas, colores y disponibilidad.</p>
              <div className="contact-address"><MapPin size={22} /><div><strong>Visítanos en 501</strong><address>Carrera 12 # 6-06<br />Barrio Valencia</address></div></div>
            </div>
            <div className="contact-card">
              <MessageCircle size={32} />
              <h2>Atención por WhatsApp</h2>
              <p>Lunes a sábado · 9:00 a. m. — 7:00 p. m.</p>
              <a className="button button--whatsapp" href={whatsappLink("Hola, vengo del catálogo web de 501 y necesito asesoría.")} target="_blank" rel="noreferrer">Escribir ahora <ArrowRight size={18} /></a>
              <button className="text-link" onClick={() => goPage("/catalogo")}>Ir al catálogo <ArrowRight size={16} /></button>
            </div>
          </div>
        </section>}
      </main>

      <footer className="footer" id="contacto">
        <div className="container footer__grid">
          <div>
            <div className="footer-brand"><span>501</span><small>DENIM & STYLE</small></div>
            <p>Moda urbana y atención cercana para elegir tus prendas desde el celular.</p>
            <SocialLinks compact />
          </div>
          <div className="footer-links">
            <strong>Explora</strong>
            <button onClick={openCatalog}>Catálogo</button>
            <button onClick={() => goPage("/categorias")}>Categorías</button>
            <button onClick={() => goPage("/marcas")}>Marcas</button>
          </div>
          <div className="footer-links">
            <strong>Ayuda</strong>
            <a href={whatsappLink("Hola, necesito ayuda con mi compra en 501.")} target="_blank" rel="noreferrer">WhatsApp</a>
            <a href="#contacto">Envíos y pagos</a>
            <a href="#contacto">Cambios</a>
          </div>
          <div className="footer-contact">
            <strong>¿Te ayudamos?</strong>
            <p>Lunes a sábado<br />9:00 a. m. — 7:00 p. m.</p>
            <address>Carrera 12 # 6-06<br />Barrio Valencia</address>
            <a href={whatsappLink("Hola, vengo del catálogo web de 501 y necesito asesoría.")} target="_blank" rel="noreferrer"><MessageCircle size={18} /> Escríbenos</a>
          </div>
        </div>
        <div className="container footer__bottom"><span>© 2026 501 Denim & Style</span><span>Hecho para comprar fácil.</span></div>
        <div className="akora-strip">
          <a href="https://api.whatsapp.com/send?phone=573148320587&text=Hola%2C%20vi%20el%20sitio%20web%20de%20501%20y%20me%20interesa%20una%20p%C3%A1gina%20con%20Akora" target="_blank" rel="noreferrer">Sitio web por <strong>Akora</strong></a>
        </div>
      </footer>

      <a className="whatsapp-float" href={whatsappLink("Hola, vengo del catálogo web de 501.")} target="_blank" rel="noreferrer" aria-label="Escribir por WhatsApp">
        <MessageCircle size={25} />
      </a>

      <nav className="bottom-nav" aria-label="Navegación móvil">
        <button className={page === "inicio" ? "active" : ""} onClick={() => goPage("/")}><Home size={20} /><span>Inicio</span></button>
        <button className={page === "categorias" || page === "categoria" ? "active" : ""} onClick={() => { setMobileNavSection("categorias"); setMenuOpen(true); }}><Store size={20} /><span>Categorías</span></button>
        <button className={page === "marcas" || page === "marca" ? "active" : ""} onClick={() => { setMobileNavSection("marcas"); setMenuOpen(true); }}><Sparkles size={20} /><span>Marcas</span></button>
        <button className={page === "catalogo" ? "active" : ""} onClick={openCatalog}><Search size={20} /><span>Catálogo</span></button>
        <a href={whatsappLink("Hola, vengo del catálogo web de 501.")} target="_blank" rel="noreferrer"><MessageCircle size={20} /><span>WhatsApp</span></a>
      </nav>

      {menuOpen && (
        <div className="overlay" onMouseDown={() => setMenuOpen(false)}>
          <aside className="mobile-menu" onMouseDown={(event) => event.stopPropagation()}>
            <div className="drawer-head">
              <div className="footer-brand footer-brand--dark"><span>501</span><small>DENIM & STYLE</small></div>
              <button className="icon-button" onClick={() => setMenuOpen(false)} aria-label="Cerrar menú"><X /></button>
            </div>
            <div className="mobile-menu__links">
              <button onClick={() => goPage("/")}>Inicio <ChevronRight /></button>
              <button aria-expanded={mobileNavSection === "categorias"} onClick={() => setMobileNavSection(mobileNavSection === "categorias" ? null : "categorias")}>Categorías <ChevronDown /></button>
              {mobileNavSection === "categorias" && <div className="mobile-menu__submenu"><button onClick={() => goPage("/categorias")}>Ver todas</button>{visibleCategories.map((item) => <button key={item.name} onClick={() => openCategory(item.name)}>{item.name}</button>)}</div>}
              <button aria-expanded={mobileNavSection === "marcas"} onClick={() => setMobileNavSection(mobileNavSection === "marcas" ? null : "marcas")}>Marcas <ChevronDown /></button>
              {mobileNavSection === "marcas" && <div className="mobile-menu__submenu"><button onClick={() => goPage("/marcas")}>Ver todas</button>{featuredBrands.map((name) => <button key={name} onClick={() => openBrand(name)}>{name}</button>)}</div>}
              <button onClick={openCatalog}>Catálogo <ChevronRight /></button>
              <button onClick={() => goPage("/contacto")}>Contacto <ChevronRight /></button>
            </div>
            <a className="button button--red menu-whatsapp" href={whatsappLink("Hola, vengo del catálogo web de 501.")} target="_blank" rel="noreferrer"><MessageCircle size={18} /> Comprar por WhatsApp</a>
          </aside>
        </div>
      )}

      {filtersOpen && (
        <div className="overlay" onMouseDown={() => setFiltersOpen(false)}>
          <aside className="bottom-sheet" onMouseDown={(event) => event.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="drawer-head"><h3>Filtrar catálogo</h3><button className="icon-button" onClick={() => setFiltersOpen(false)} aria-label="Cerrar filtros"><X /></button></div>
            <FilterOptions brand={brand} gender={gender} size={size} color={color} brands={brands} sizes={sizes} colors={colors} onBrand={setBrand} onGender={setGender} onSize={setSize} onColor={setColor} />
            <div className="sheet-actions">
              <button className="button button--outline" onClick={() => { setBrand("Todas"); setGender("Todos"); setSize("Todas"); setColor("Todos"); }}>Limpiar</button>
              <button className="button button--red" onClick={() => setFiltersOpen(false)}>Ver {filteredProducts.length} productos</button>
            </div>
          </aside>
        </div>
      )}

      {cartOpen && (
        <div className="overlay" onMouseDown={() => setCartOpen(false)}>
          <aside className="cart-drawer" onMouseDown={(event) => event.stopPropagation()}>
            <div className="drawer-head"><div><span className="section-kicker">Tu selección</span><h3>Mi pedido ({cartCount})</h3></div><button className="icon-button" onClick={() => setCartOpen(false)} aria-label="Cerrar pedido"><X /></button></div>
            <div className="cart-items">
              {cartCount === 0 ? (
                <div className="cart-empty"><ShoppingBag size={34} /><h4>Tu pedido está vacío</h4><p>Agrega prendas y te ayudamos a confirmar todo por WhatsApp.</p><button className="button button--dark" onClick={() => { setCartOpen(false); goPage("/catalogo"); }}>Ver catálogo</button></div>
              ) : Object.entries(cart).map(([key, item]) => {
                const product = catalogProducts.find((productItem) => productItem.id === item.productId);
                if (!product) return null;
                return <div className="cart-item" key={key}>
                  <img src={product.image} alt="" />
                  <div className="cart-item__info"><small>{product.reference}</small><strong>{product.name}</strong><em>{item.size ? `Talla ${item.size} · ` : ""}{item.color}</em></div>
                  <div className="quantity"><button onClick={() => updateQuantity(key, -1)} aria-label="Quitar una unidad"><Minus size={15} /></button><span>{item.quantity}</span><button onClick={() => updateQuantity(key, 1)} aria-label="Agregar una unidad"><Plus size={15} /></button></div>
                </div>;
              })}
            </div>
            {cartCount > 0 && <div className="cart-summary"><small>Enviaremos las referencias y los enlaces de tu selección.</small><a className="button button--whatsapp" href={whatsappLink(cartMessage)} target="_blank" rel="noreferrer"><MessageCircle size={19} /> Preguntar por WhatsApp</a></div>}
          </aside>
        </div>
      )}

      {selectedProduct && (
        <div className="overlay overlay--center" onMouseDown={() => setSelectedProduct(null)}>
          <article className="product-modal" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedProduct(null)} aria-label="Cerrar"><X /></button>
            <div className="product-modal__image">
              <ProductImageZoom key={`${selectedProduct.id}-${selectedImage}`} src={(selectedProduct.images?.length ? selectedProduct.images : [selectedProduct.image])[selectedImage]} alt={selectedProduct.name} onOpen={() => { setZoomedProduct(selectedProduct); setZoomScale(1); }} />
              {selectedProduct.badge && <span className="product-badge">{selectedProduct.badge}</span>}
              <button className="image-zoom-button" onClick={() => { setZoomedProduct(selectedProduct); setZoomScale(1); }} aria-label="Ampliar fotografía"><ZoomIn size={20} /><span>Ampliar</span></button>
            </div>
            <div className="product-modal__content">
              <small>{selectedProduct.brand} · {selectedProduct.colors.join(", ")} · {selectedProduct.reference}</small>
              <h3>{selectedProduct.name}</h3>
              <p>{selectedProduct.description}</p>
              {(selectedProduct.images?.length || 0) > 1 && <div className="product-thumbnails">{selectedProduct.images!.map((image, index) => <button type="button" className={selectedImage === index ? "active" : ""} onClick={() => setSelectedImage(index)} key={image} aria-label={selectedProduct.badge === "Vista en modelo" ? (index === 0 ? "Ver vista en modelo" : "Ver foto real de la prenda") : `Ver foto ${index + 1}`}><img src={image} alt="" /></button>)}</div>}
              <div className="product-options">
                {selectedProduct.sizes.length > 0 && <div><b>Elige tu talla</b><span>{selectedProduct.sizes.map((size) => <button type="button" className={selectedSize === size ? "active" : ""} key={size} onClick={() => setSelectedSize(size)}>{size}{selectedSize === size && <Check size={12} />}</button>)}</span></div>}
                <div><b>Elige el color</b><span>{selectedProduct.colors.map((color) => <button type="button" className={selectedColor === color ? "active" : ""} key={color} onClick={() => setSelectedColor(color)}>{color}</button>)}</span></div>
              </div>
              <div className="product-modal__inquiries">
                <a className="button button--whatsapp" href={whatsappLink(productMessage(selectedProduct, "retail", selectedSize, selectedColor))} target="_blank" rel="noreferrer"><MessageCircle size={18} /> Consultar este producto</a>
                <a className="button button--outline" href={whatsappLink(productMessage(selectedProduct, "wholesale", selectedSize, selectedColor))} target="_blank" rel="noreferrer">Soy mayorista · consultar precio{selectedProduct.minimum > 1 ? ` (mín. ${selectedProduct.minimum})` : ""}</a>
              </div>
              <button className="modal-whatsapp" onClick={() => { addToCart(selectedProduct, selectedSize, selectedColor); setSelectedProduct(null); }}>Agregar a mi pedido <ShoppingBag size={18} /></button>
            </div>
          </article>
        </div>
      )}

      {zoomedProduct && (
        <div className="zoom-viewer" onMouseDown={() => setZoomedProduct(null)}>
          <div className="zoom-viewer__toolbar" onMouseDown={(event) => event.stopPropagation()}>
            <span>{zoomedProduct.name}</span>
            <div>
              <button onClick={() => setZoomScale((value) => Math.max(1, value - .5))} aria-label="Alejar imagen"><ZoomOut /></button>
              <b>{Math.round(zoomScale * 100)}%</b>
              <button onClick={() => setZoomScale((value) => Math.min(3, value + .5))} aria-label="Acercar imagen"><ZoomIn /></button>
              <button onClick={() => setZoomedProduct(null)} aria-label="Cerrar ampliación"><X /></button>
            </div>
          </div>
          <div className="zoom-viewer__stage" onMouseDown={(event) => event.stopPropagation()}>
            <img src={(zoomedProduct.images?.length ? zoomedProduct.images : [zoomedProduct.image])[selectedImage]} alt={`Vista ampliada de ${zoomedProduct.name}`} style={{ transform: `scale(${zoomScale})` }} />
          </div>
        </div>
      )}

      {toast && <div className="toast"><Check size={17} /> {toast}</div>}
    </div>
  );
}

function ProductCard({ product, favorite, onFavorite, onOpen }: {
  product: Product;
  favorite: boolean;
  onFavorite: () => void;
  onOpen: () => void;
}) {
  const modelPhoto = isModelPhoto(product);
  const imageFocus = modelPhoto
    ? product.category === "Jeans" ? "jeans"
      : product.category === "Bermudas" ? "bermudas"
        : product.category === "Conjuntos" ? "full"
          : "upper"
    : "product";

  return (
    <article className="product-card">
      <div className="product-card__image" data-focus={imageFocus} onClick={onOpen}>
        <img src={product.image} alt={`${product.name}, ${product.brand}, color ${product.colors.join(", ")}`} loading="lazy" />
        {product.badge && <span className={`product-badge ${product.badge === "Oferta" ? "product-badge--sale" : ""}`}>{product.badge}</span>}
        <button className={`favorite-button ${favorite ? "active" : ""}`} onClick={(event) => { event.stopPropagation(); onFavorite(); }} aria-label="Guardar en favoritos"><Heart size={19} fill={favorite ? "currentColor" : "none"} /></button>
        <button className="quick-view" onClick={(event) => { event.stopPropagation(); onOpen(); }} aria-label={`Inspeccionar ${product.name}`}><ZoomIn size={17} /><span>Inspeccionar</span></button>
      </div>
      <div className="product-card__body">
        <div className="product-card__tags"><span>{product.brand}</span><span>{product.colors.join(", ")}</span></div>
        <h3 onClick={onOpen}>{product.name}</h3>
        <span className="product-card__ref">Ref. {product.reference}</span>
        <div className="product-card__sizes">{product.sizes.length ? product.sizes.slice(0, 5).map((size) => <span key={size}>{size}</span>) : <span>Tallas por consultar</span>}</div>
        <button className="add-button" onClick={onOpen} aria-label={`Ver opciones de ${product.name}`}><ArrowRight size={17} /><span>Ver producto</span></button>
      </div>
    </article>
  );
}

function FilterOptions({ brand, gender, size, color, brands, sizes, colors, onBrand, onGender, onSize, onColor }: {
  brand: string;
  gender: string;
  size: string;
  color: string;
  brands: string[];
  sizes: string[];
  colors: string[];
  onBrand: (value: string) => void;
  onGender: (value: string) => void;
  onSize: (value: string) => void;
  onColor: (value: string) => void;
}) {
  return <div className="filter-options">
    <fieldset><legend>Marca</legend>{brands.map((item) => <label key={item}><input type="radio" name="brand" checked={brand === item} onChange={() => onBrand(item)} /><span>{item}</span></label>)}</fieldset>
    <fieldset><legend>Para</legend><div className="option-pills">{genders.map((item) => <button key={item} className={gender === item ? "active" : ""} onClick={() => onGender(item)}>{item}</button>)}</div></fieldset>
    <fieldset><legend>Talla</legend><div className="option-pills">{sizes.map((item) => <button key={item} className={size === item ? "active" : ""} onClick={() => onSize(item)}>{item}</button>)}</div></fieldset>
    <fieldset><legend>Color</legend><div className="option-pills">{colors.map((item) => <button key={item} className={color === item ? "active" : ""} onClick={() => onColor(item)}>{item}</button>)}</div></fieldset>
  </div>;
}

export default App;
