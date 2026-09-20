import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BadgePercent,
  Check,
  ChevronDown,
  ChevronRight,
  Heart,
  Home,
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
import heroImage from "./assets/hero-501.webp";
import { categories, products, type Category, type Product } from "./data";
import { WHATSAPP_PHONE } from "./config";

type Mode = "retail" | "wholesale";
type CartItem = { productId: number; size: string; color: string; quantity: number };
type Cart = Record<string, CartItem>;

const brands = ["Todas", ...Array.from(new Set(products.map((product) => product.brand)))];
const genders = ["Todos", "Mujer", "Hombre", "Unisex"];
const sizes = ["Todas", ...Array.from(new Set(products.flatMap((product) => product.sizes)))];
const colors = ["Todos", ...Array.from(new Set(products.flatMap((product) => product.colors)))];
const bestSellers = products.filter((product) => [1, 2, 4, 5].includes(product.id));

const money = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

function whatsappLink(message: string) {
  return `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(message)}`;
}

function ModeSwitch({ mode, onChange, compact = false }: { mode: Mode; onChange: (mode: Mode) => void; compact?: boolean }) {
  return (
    <div className={`mode-switch ${compact ? "mode-switch--compact" : ""}`} aria-label="Tipo de compra">
      <button className={mode === "retail" ? "active" : ""} onClick={() => onChange("retail")}>
        Detal
      </button>
      <button className={mode === "wholesale" ? "active" : ""} onClick={() => onChange("wholesale")}>
        Mayorista
      </button>
    </div>
  );
}

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("retail");
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [category, setCategory] = useState<"Todos" | Category>("Todos");
  const [brand, setBrand] = useState("Todas");
  const [gender, setGender] = useState("Todos");
  const [size, setSize] = useState("Todas");
  const [color, setColor] = useState("Todos");
  const [maxPrice, setMaxPrice] = useState(250000);
  const [menuOpen, setMenuOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [zoomedProduct, setZoomedProduct] = useState<Product | null>(null);
  const [zoomScale, setZoomScale] = useState(1);
  const [favorites, setFavorites] = useState<Set<number>>(new Set());
  const [cart, setCart] = useState<Cart>({});
  const [toast, setToast] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const page = location.pathname === "/catalogo"
    ? "catalogo"
    : location.pathname === "/mayoristas"
      ? "mayoristas"
      : location.pathname === "/contacto"
        ? "contacto"
        : "inicio";

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return products.filter((product) => {
      const matchesSearch = !query || [product.name, product.brand, product.reference, product.category]
        .join(" ")
        .toLowerCase()
        .includes(query);
      return matchesSearch
        && (category === "Todos" || product.category === category)
        && (brand === "Todas" || product.brand === brand)
        && (gender === "Todos" || product.gender === gender)
        && (size === "Todas" || product.sizes.includes(size))
        && (color === "Todos" || product.colors.includes(color))
        && (mode === "retail" ? product.retail : product.wholesale) <= maxPrice;
    });
  }, [brand, category, color, gender, maxPrice, mode, search, size]);

  const activeExtraFilters = [brand !== "Todas", gender !== "Todos", size !== "Todas", color !== "Todos", maxPrice < 250000].filter(Boolean).length;

  const cartCount = Object.values(cart).reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = Object.values(cart).reduce((sum, item) => {
    const product = products.find((productItem) => productItem.id === item.productId);
    if (!product) return sum;
    return sum + (mode === "retail" ? product.retail : product.wholesale) * item.quantity;
  }, 0);

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
    if (location.pathname === "/mayoristas") setMode("wholesale");
  }, [location.pathname]);

  const goPage = (path: string) => navigate(path);
  const goWholesalePage = () => {
    setMode("wholesale");
    navigate("/mayoristas");
  };
  const goHomeSection = (id: string) => {
    navigate("/");
    window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }), 80);
  };

  const goTo = (id: string) => {
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const chooseMode = (nextMode: Mode, shouldScroll = false) => {
    setMode(nextMode);
    if (shouldScroll) goPage(nextMode === "wholesale" ? "/mayoristas" : "/catalogo");
  };

  const chooseCategory = (nextCategory: Category) => {
    setCategory(nextCategory);
    goPage("/catalogo");
  };

  const toggleFavorite = (id: number) => {
    setFavorites((current) => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const openProduct = (product: Product) => {
    setSelectedProduct(product);
    setSelectedSize(product.sizes[0] || "");
    setSelectedColor(product.colors[0] || "");
  };

  const addToCart = (product: Product, size: string, color: string) => {
    if (!size) {
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
    setToast(`${product.name} · talla ${size}`);
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
      const product = products.find((productItem) => productItem.id === item.productId);
      return product ? `• ${item.quantity} x ${product.name} (${product.reference}) — talla ${item.size}, ${item.color}` : "";
    }).filter(Boolean);
    return [
      `Hola, quiero cotizar este pedido ${mode === "wholesale" ? "mayorista" : "al detal"}:`,
      ...lines,
      `Total estimado: ${money.format(cartTotal)}`,
      "¿Me confirman disponibilidad, tallas y colores?",
    ].join("\n");
  }, [cart, cartTotal, mode]);

  return (
    <div className="site-shell">
      <div className="announcement">
        <span>Envíos a toda Colombia</span>
        <span className="announcement__dot" />
        <span>Precios especiales desde 6 unidades</span>
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
            <button onClick={() => goHomeSection("categorias")}>Categorías</button>
            <button className={page === "catalogo" ? "active" : ""} onClick={() => goPage("/catalogo")}>Catálogo</button>
            <button className={page === "mayoristas" ? "active" : ""} onClick={goWholesalePage}>Mayoristas</button>
            <button className={page === "contacto" ? "active" : ""} onClick={() => goPage("/contacto")}>Contacto</button>
          </nav>

          <div className="header__actions">
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
        <section className="hero" id="inicio">
          <img className="hero__image" src={heroImage} alt="Moda denim para mujer y hombre" />
          <div className="hero__shade" />
          <div className="hero__content container">
            <div className="hero__copy">
              <div className="hero__eyebrow"><Sparkles size={15} /> Nueva colección 2026</div>
              <h1>Denim para<br /><em>tu ritmo.</em></h1>
              <p>Jeans, chaquetas, camisas y conjuntos para vestir con actitud. Compra al detal o surte tu negocio.</p>
              <div className="hero__buttons">
                <button className="button button--red" onClick={() => chooseMode("retail", true)}>
                  Comprar al detal <ArrowRight size={18} />
                </button>
                <button className="button button--glass" onClick={goWholesalePage}>
                  Soy mayorista
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

        <section className="shopping-mode">
          <div className="container shopping-mode__inner">
            <div>
              <span className="section-kicker">Elige cómo comprar</span>
              <h2>Una tienda, dos experiencias</h2>
            </div>
            <div className="shopping-mode__control">
              <ModeSwitch mode={mode} onChange={(nextMode) => chooseMode(nextMode, true)} />
              <div className="shopping-mode__action">
                <p>{mode === "retail" ? "Precios por unidad para renovar tu clóset." : "Precios por volumen para hacer crecer tu negocio."}</p>
                <button onClick={() => chooseMode(mode, true)}>Ver productos <ArrowRight size={15} /></button>
              </div>
            </div>
          </div>
        </section>

        <section className="section categories-section" id="categorias">
          <div className="container">
            <div className="section-heading">
              <div>
                <span className="section-kicker">Encuentra lo tuyo</span>
                <h2>Compra por categoría</h2>
              </div>
              <button className="text-link" onClick={() => { setCategory("Todos"); goPage("/catalogo"); }}>
                Ver todo <ArrowRight size={17} />
              </button>
            </div>
            <div className="category-grid">
              {categories.map((item) => (
                <button className="category-card" key={item.name} onClick={() => chooseCategory(item.name)}>
                  <img src={item.image} alt={item.name} />
                  <div className="category-card__shade" />
                  <div className="category-card__content">
                    <span>{item.eyebrow}</span>
                    <h3>{item.name}</h3>
                    <small>{item.count} referencias</small>
                  </div>
                  <span className="category-card__arrow"><ArrowRight size={18} /></span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="brand-strip" aria-label="Marcas destacadas">
          <div className="container brand-strip__inner">
            <div className="brand-strip__heading">
              <span className="section-kicker">Marcas que encuentras</span>
              <h2>Elige tu marca favorita</h2>
            </div>
            <div className="brand-logos">
              {brands.slice(1).map((item) => <button className={`brand-logo brand-logo--${item.toLowerCase().replace(/[^a-z0-9]/g, "")}`} key={item} onClick={() => { setBrand(item); goPage("/catalogo"); }}><span>{item}</span><small>Ver productos <ArrowRight size={13} /></small></button>)}
            </div>
          </div>
        </section>

        <section className="section best-sellers-section">
          <div className="container">
            <div className="section-heading">
              <div>
                <span className="section-kicker">Los favoritos de todos</span>
                <h2>Más vendidos</h2>
              </div>
              <button className="text-link" onClick={() => { setCategory("Todos"); setBrand("Todas"); goPage("/catalogo"); }}>Ver catálogo completo <ArrowRight size={17} /></button>
            </div>
            <div className="home-products-grid">
              {bestSellers.map((product) => <ProductCard
                key={product.id}
                product={product}
                mode={mode}
                favorite={favorites.has(product.id)}
                onFavorite={() => toggleFavorite(product.id)}
                onOpen={() => openProduct(product)}
                onAdd={() => openProduct(product)}
              />)}
            </div>
            <button className="button button--dark home-catalog-cta" onClick={() => goPage("/catalogo")}>Explorar todo el catálogo <ArrowRight size={18} /></button>
          </div>
        </section>
        </>}

        {page === "catalogo" && <section className="section catalog-section" id="catalogo">
          <div className="container">
            <div className="catalog-top">
              <div>
                <span className="section-kicker">Catálogo 501</span>
                <h2><span className="desktop-catalog-title">{mode === "retail" ? "Nuevos favoritos" : "Precios para tu negocio"}</span><span className="mobile-catalog-title">Catálogo</span></h2>
              </div>
              <ModeSwitch mode={mode} onChange={setMode} compact />
            </div>

            <div className="catalog-tools">
              <label className={`search-box ${searchOpen ? "search-box--open" : ""}`}>
                <Search size={19} />
                <input ref={searchRef} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Busca prenda, marca o referencia" />
                {(search || searchOpen) && <button onClick={() => { setSearch(""); setSearchOpen(false); }} aria-label="Cerrar búsqueda"><X size={17} /></button>}
              </label>
              <button className="filter-trigger" onClick={() => setFiltersOpen(true)}>
                <SlidersHorizontal size={18} /> Filtrar
                {activeExtraFilters > 0 && <span className="filter-count">{activeExtraFilters}</span>}
              </button>
              <div className="desktop-filters">
                <select value={brand} onChange={(event) => setBrand(event.target.value)} aria-label="Filtrar por marca">
                  {brands.map((item) => <option key={item}>{item}</option>)}
                </select>
                <select value={gender} onChange={(event) => setGender(event.target.value)} aria-label="Filtrar por género">
                  {genders.map((item) => <option key={item}>{item}</option>)}
                </select>
              </div>
            </div>

            <div className="mobile-filter-chips" aria-label="Filtros rápidos">
              <button onClick={() => setFiltersOpen(true)}>{brand === "Todas" ? "Marca" : brand}<ChevronDown size={13} /></button>
              <button onClick={() => setFiltersOpen(true)}>{size === "Todas" ? "Talla" : size}<ChevronDown size={13} /></button>
              <button onClick={() => setFiltersOpen(true)}>{color === "Todos" ? "Color" : color}<ChevronDown size={13} /></button>
              <button onClick={() => setFiltersOpen(true)}>{maxPrice === 250000 ? "Precio" : money.format(maxPrice)}<ChevronDown size={13} /></button>
            </div>

            <div className="category-pills" aria-label="Filtro de categorías">
              {(["Todos", ...categories.map((item) => item.name)] as const).map((item) => (
                <button key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}</button>
              ))}
            </div>

            <div className="results-line">
              <span>{filteredProducts.length} productos</span>
              {mode === "wholesale" && <span className="wholesale-note"><BadgePercent size={15} /> Precio mayorista activo</span>}
            </div>

            {filteredProducts.length > 0 ? (
              <div className="product-grid">
                {filteredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    mode={mode}
                    favorite={favorites.has(product.id)}
                    onFavorite={() => toggleFavorite(product.id)}
                    onOpen={() => openProduct(product)}
                    onAdd={() => openProduct(product)}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <Search size={30} />
                <h3>No encontramos coincidencias</h3>
                <p>Prueba otra búsqueda o limpia los filtros.</p>
                <button className="button button--dark" onClick={() => { setSearch(""); setCategory("Todos"); setBrand("Todas"); setGender("Todos"); setSize("Todas"); setColor("Todos"); setMaxPrice(250000); }}>Limpiar filtros</button>
              </div>
            )}
          </div>
        </section>}

        {page === "inicio" && <section className="promo-section section">
          <div className="container promo-grid">
            <article className="promo-card promo-card--red">
              <span>Combo mayorista</span>
              <h3>6 jeans desde<br />$569.400</h3>
              <p>Combina tallas y tonos según disponibilidad.</p>
              <button onClick={() => chooseMode("wholesale", true)}>Ver oferta <ArrowRight size={17} /></button>
            </article>
            <article className="promo-card promo-card--black">
              <span>Envío nacional</span>
              <h3>Tu pedido,<br />donde estés.</h3>
              <p>Despachos seguros a ciudades de toda Colombia.</p>
              <a href={whatsappLink("Hola, quiero consultar el envío de un pedido de 501.")} target="_blank" rel="noreferrer">Consultar envío <ArrowRight size={17} /></a>
            </article>
          </div>
        </section>}

        {page === "mayoristas" && <>
          <section className="hero hero--wholesale" id="mayoristas">
            <img className="hero__image" src={heroImage} alt="Moda denim para surtir tu negocio" />
            <div className="hero__shade" />
            <div className="hero__content container">
              <div className="hero__copy">
                <div className="hero__eyebrow"><Sparkles size={15} /> Precios para tu negocio</div>
                <h1>Denim para<br /><em>crecer.</em></h1>
                <p>Surte tu negocio con referencias que sí se mueven, precios por volumen y acompañamiento en cada pedido.</p>
                <div className="hero__buttons">
                  <button className="button button--red" onClick={() => document.querySelector(".wholesale-catalog-section")?.scrollIntoView({ behavior: "smooth" })}>
                    Ver catálogo mayorista <ArrowRight size={18} />
                  </button>
                  <a className="button button--glass" href={whatsappLink("Hola, quiero recibir información y catálogo mayorista de 501.")} target="_blank" rel="noreferrer">
                    Hablar con un asesor
                  </a>
                </div>
                <div className="hero__proof">
                  <span><Check size={15} /> Mezcla referencias</span>
                  <span><Check size={15} /> Envíos nacionales</span>
                </div>
              </div>
            </div>
          </section>

          <section className="wholesale-steps-section">
            <div className="container wholesale-steps-heading">
              <span className="section-kicker section-kicker--light">Comprar es muy fácil</span>
              <h2>Tu pedido mayorista en 3 pasos</h2>
            </div>
            <div className="container wholesale-steps">
              <div><b>01</b><span><strong>Elige tus prendas</strong><small>Filtra el catálogo y arma tu selección.</small></span></div>
              <div><b>02</b><span><strong>Cotiza por WhatsApp</strong><small>Confirmamos stock, tallas y precio final.</small></span></div>
              <div><b>03</b><span><strong>Recibe tu pedido</strong><small>Enviamos de forma segura a tu ciudad.</small></span></div>
            </div>
          </section>
        </>}

        {page === "mayoristas" && <section className="section wholesale-catalog-section">
          <div className="container">
            <div className="section-heading wholesale-catalog-heading">
              <div>
                <span className="section-kicker">Precios para tu negocio</span>
                <h2>Catálogo mayorista</h2>
                <p>Todos los productos muestran precio por volumen y cantidad mínima.</p>
              </div>
              <button className="text-link" onClick={() => goPage("/catalogo")}>Ver catálogo al detal <ArrowRight size={17} /></button>
            </div>

            <div className="category-pills wholesale-category-pills" aria-label="Categorías mayoristas">
              {(["Todos", ...categories.map((item) => item.name)] as const).map((item) => (
                <button key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}</button>
              ))}
            </div>

            <div className="results-line">
              <span>{filteredProducts.length} productos para mayoristas</span>
              <span className="wholesale-note"><BadgePercent size={15} /> Precio mayorista activo</span>
            </div>

            {filteredProducts.length > 0 ? <div className="product-grid wholesale-product-grid">
              {filteredProducts.map((product) => <ProductCard
                key={product.id}
                product={product}
                mode="wholesale"
                favorite={favorites.has(product.id)}
                onFavorite={() => toggleFavorite(product.id)}
                onOpen={() => openProduct(product)}
                onAdd={() => openProduct(product)}
              />)}
            </div> : <div className="empty-state"><Search size={30} /><h3>No hay productos con estos filtros</h3><button className="button button--dark" onClick={() => { setCategory("Todos"); setBrand("Todas"); setGender("Todos"); setSize("Todas"); setColor("Todos"); setMaxPrice(250000); }}>Mostrar todos</button></div>}
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
              <p>Cuéntanos qué prendas buscas, si compras al detal o al por mayor, y te ayudamos a confirmar tallas, colores y disponibilidad.</p>
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
            <p>Moda urbana para comprar al detal y al por mayor, fácil desde tu celular.</p>
          </div>
          <div className="footer-links">
            <strong>Explora</strong>
            <button onClick={() => goPage("/catalogo")}>Catálogo</button>
            <button onClick={() => goHomeSection("categorias")}>Categorías</button>
            <button onClick={goWholesalePage}>Mayoristas</button>
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
        <button className={page === "catalogo" ? "active" : ""} onClick={() => goPage("/catalogo")}><Store size={20} /><span>Catálogo</span></button>
        <button className={page === "mayoristas" ? "active" : ""} onClick={goWholesalePage}><BadgePercent size={20} /><span>Mayorista</span></button>
        <button onClick={focusSearch}><Search size={20} /><span>Buscar</span></button>
        <a href={whatsappLink("Hola, vengo del catálogo web de 501.")} target="_blank" rel="noreferrer"><MessageCircle size={20} /><span>WhatsApp</span></a>
      </nav>

      {menuOpen && (
        <div className="overlay" onMouseDown={() => setMenuOpen(false)}>
          <aside className="mobile-menu" onMouseDown={(event) => event.stopPropagation()}>
            <div className="drawer-head">
              <div className="footer-brand footer-brand--dark"><span>501</span><small>DENIM & STYLE</small></div>
              <button className="icon-button" onClick={() => setMenuOpen(false)} aria-label="Cerrar menú"><X /></button>
            </div>
            <ModeSwitch mode={mode} onChange={setMode} />
            <div className="mobile-menu__links">
              <button onClick={() => goPage("/")}>Inicio <ChevronRight /></button>
              <button onClick={() => goHomeSection("categorias")}>Categorías <ChevronRight /></button>
              <button onClick={() => goPage("/catalogo")}>Catálogo <ChevronRight /></button>
              <button onClick={goWholesalePage}>Mayoristas <ChevronRight /></button>
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
            <FilterOptions brand={brand} gender={gender} size={size} color={color} maxPrice={maxPrice} onBrand={setBrand} onGender={setGender} onSize={setSize} onColor={setColor} onMaxPrice={setMaxPrice} />
            <div className="sheet-actions">
              <button className="button button--outline" onClick={() => { setBrand("Todas"); setGender("Todos"); setSize("Todas"); setColor("Todos"); setMaxPrice(250000); }}>Limpiar</button>
              <button className="button button--red" onClick={() => setFiltersOpen(false)}>Ver {filteredProducts.length} productos</button>
            </div>
          </aside>
        </div>
      )}

      {cartOpen && (
        <div className="overlay" onMouseDown={() => setCartOpen(false)}>
          <aside className="cart-drawer" onMouseDown={(event) => event.stopPropagation()}>
            <div className="drawer-head"><div><span className="section-kicker">Tu selección</span><h3>Mi pedido ({cartCount})</h3></div><button className="icon-button" onClick={() => setCartOpen(false)} aria-label="Cerrar pedido"><X /></button></div>
            <ModeSwitch mode={mode} onChange={setMode} compact />
            <div className="cart-items">
              {cartCount === 0 ? (
                <div className="cart-empty"><ShoppingBag size={34} /><h4>Tu pedido está vacío</h4><p>Agrega prendas y te ayudamos a confirmar todo por WhatsApp.</p><button className="button button--dark" onClick={() => { setCartOpen(false); goPage("/catalogo"); }}>Ver catálogo</button></div>
              ) : Object.entries(cart).map(([key, item]) => {
                const product = products.find((productItem) => productItem.id === item.productId);
                if (!product) return null;
                return <div className="cart-item" key={key}>
                  <img src={product.image} alt="" />
                  <div className="cart-item__info"><small>{product.reference}</small><strong>{product.name}</strong><em>Talla {item.size} · {item.color}</em><span>{money.format(mode === "retail" ? product.retail : product.wholesale)}</span></div>
                  <div className="quantity"><button onClick={() => updateQuantity(key, -1)} aria-label="Quitar una unidad"><Minus size={15} /></button><span>{item.quantity}</span><button onClick={() => updateQuantity(key, 1)} aria-label="Agregar una unidad"><Plus size={15} /></button></div>
                </div>;
              })}
            </div>
            {cartCount > 0 && <div className="cart-summary"><div><span>Total estimado</span><strong>{money.format(cartTotal)}</strong></div>{mode === "wholesale" && <small>El valor final se confirma según cantidades y disponibilidad.</small>}<a className="button button--whatsapp" href={whatsappLink(cartMessage)} target="_blank" rel="noreferrer"><MessageCircle size={19} /> Cotizar por WhatsApp</a></div>}
          </aside>
        </div>
      )}

      {selectedProduct && (
        <div className="overlay overlay--center" onMouseDown={() => setSelectedProduct(null)}>
          <article className="product-modal" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedProduct(null)} aria-label="Cerrar"><X /></button>
            <div className="product-modal__image">
              <img src={selectedProduct.image} alt={selectedProduct.name} onClick={() => { setZoomedProduct(selectedProduct); setZoomScale(1); }} />
              {selectedProduct.badge && <span className="product-badge">{selectedProduct.badge}</span>}
              <button className="image-zoom-button" onClick={() => { setZoomedProduct(selectedProduct); setZoomScale(1); }} aria-label="Ampliar fotografía"><ZoomIn size={20} /><span>Ampliar</span></button>
            </div>
            <div className="product-modal__content">
              <small>{selectedProduct.brand} · {selectedProduct.reference}</small>
              <h3>{selectedProduct.name}</h3>
              <p>{selectedProduct.description}</p>
              <div className="modal-price"><strong>{money.format(mode === "retail" ? selectedProduct.retail : selectedProduct.wholesale)}</strong><span>{mode === "retail" ? "precio por unidad" : `desde ${selectedProduct.minimum} unidades`}</span></div>
              <div className="product-options">
                <div><b>Elige tu talla</b><span>{selectedProduct.sizes.map((size) => <button type="button" className={selectedSize === size ? "active" : ""} key={size} onClick={() => setSelectedSize(size)}>{size}{selectedSize === size && <Check size={12} />}</button>)}</span></div>
                <div><b>Elige el color</b><span>{selectedProduct.colors.map((color) => <button type="button" className={selectedColor === color ? "active" : ""} key={color} onClick={() => setSelectedColor(color)}>{color}</button>)}</span></div>
              </div>
              <button className="button button--red modal-add" onClick={() => { addToCart(selectedProduct, selectedSize, selectedColor); setSelectedProduct(null); }}>Agregar talla {selectedSize} <ShoppingBag size={18} /></button>
              <a className="modal-whatsapp" href={whatsappLink(`Hola, me interesa ${selectedProduct.name}, ref. ${selectedProduct.reference}, talla ${selectedSize}, color ${selectedColor}, para compra ${mode === "retail" ? "al detal" : "mayorista"}.`)} target="_blank" rel="noreferrer"><MessageCircle size={18} /> Preguntar por WhatsApp</a>
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
            <img src={zoomedProduct.image} alt={`Vista ampliada de ${zoomedProduct.name}`} style={{ transform: `scale(${zoomScale})` }} />
          </div>
        </div>
      )}

      {toast && <div className="toast"><Check size={17} /> {toast}</div>}
    </div>
  );
}

function ProductCard({ product, mode, favorite, onFavorite, onOpen, onAdd }: {
  product: Product;
  mode: Mode;
  favorite: boolean;
  onFavorite: () => void;
  onOpen: () => void;
  onAdd: () => void;
}) {
  const price = mode === "retail" ? product.retail : product.wholesale;
  return (
    <article className="product-card">
      <div className="product-card__image" onClick={onOpen}>
        <img src={product.image} alt={product.name} loading="lazy" />
        {product.badge && <span className={`product-badge ${product.badge === "Oferta" ? "product-badge--sale" : ""}`}>{product.badge}</span>}
        <button className={`favorite-button ${favorite ? "active" : ""}`} onClick={(event) => { event.stopPropagation(); onFavorite(); }} aria-label="Guardar en favoritos"><Heart size={19} fill={favorite ? "currentColor" : "none"} /></button>
        <button className="quick-view" onClick={(event) => { event.stopPropagation(); onOpen(); }} aria-label={`Inspeccionar ${product.name}`}><ZoomIn size={17} /><span>Inspeccionar</span></button>
      </div>
      <div className="product-card__body">
        <span className="product-card__meta">{product.brand} · {product.gender}</span>
        <h3 onClick={onOpen}>{product.name}</h3>
        <span className="product-card__ref">Ref. {product.reference}</span>
        <div className="product-card__price"><strong>{mode === "wholesale" && <small>Desde </small>}{money.format(price)}</strong>{mode === "wholesale" && <del>{money.format(product.retail)}</del>}{mode === "wholesale" && <span>Mín. {product.minimum} und.</span>}</div>
        <div className="product-card__sizes">{product.sizes.slice(0, 5).map((size) => <span key={size}>{size}</span>)}</div>
        <button className="add-button" onClick={onAdd}><ShoppingBag size={17} /><span>Elegir talla</span></button>
      </div>
    </article>
  );
}

function FilterOptions({ brand, gender, size, color, maxPrice, onBrand, onGender, onSize, onColor, onMaxPrice }: {
  brand: string;
  gender: string;
  size: string;
  color: string;
  maxPrice: number;
  onBrand: (value: string) => void;
  onGender: (value: string) => void;
  onSize: (value: string) => void;
  onColor: (value: string) => void;
  onMaxPrice: (value: number) => void;
}) {
  return <div className="filter-options">
    <fieldset><legend>Marca</legend>{brands.map((item) => <label key={item}><input type="radio" name="brand" checked={brand === item} onChange={() => onBrand(item)} /><span>{item}</span></label>)}</fieldset>
    <fieldset><legend>Para</legend><div className="option-pills">{genders.map((item) => <button key={item} className={gender === item ? "active" : ""} onClick={() => onGender(item)}>{item}</button>)}</div></fieldset>
    <fieldset><legend>Talla</legend><div className="option-pills">{sizes.map((item) => <button key={item} className={size === item ? "active" : ""} onClick={() => onSize(item)}>{item}</button>)}</div></fieldset>
    <fieldset><legend>Color</legend><div className="option-pills">{colors.map((item) => <button key={item} className={color === item ? "active" : ""} onClick={() => onColor(item)}>{item}</button>)}</div></fieldset>
    <fieldset className="price-filter"><legend>Precio máximo <strong>{money.format(maxPrice)}</strong></legend><input type="range" min="60000" max="250000" step="10000" value={maxPrice} onChange={(event) => onMaxPrice(Number(event.target.value))} /></fieldset>
  </div>;
}

export default App;
