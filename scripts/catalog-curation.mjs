import { hasWhiteBackground, whiteBackgroundScore } from "../netlify/lib/catalog-image.mjs";

const normalize = (value) => String(value ?? "").normalize("NFKD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
const duplicateKey = (product) => [product.name, product.brand, product.category, product.gender, ...(product.colors || [])].map(normalize).join("|");

export async function curateCatalog(products, imageData) {
  const chosen = new Map();
  const excludedBackground = [];
  const excludedDuplicates = [];
  for (const product of products) {
    const images = [...new Set(product.images?.length ? product.images : [product.image])].filter(Boolean);
    let whiteImage;
    for (const url of images) {
      const { bytes } = await imageData(url);
      if (hasWhiteBackground(await whiteBackgroundScore(bytes))) {
        whiteImage = url;
        break;
      }
    }
    if (!whiteImage) {
      excludedBackground.push(product.reference);
      continue;
    }

    const description = (product.description || "")
      .replace(/La portada muestra una vista digital sobre modelo; revisa las fotos reales de la prenda\.\s*/i, "")
      .trim();
    const { badge, ...rest } = product;
    const prepared = {
      ...rest,
      image: whiteImage,
      images: [whiteImage],
      description,
      ...(badge && badge !== "Vista en modelo" ? { badge } : {}),
    };
    const key = duplicateKey(prepared);
    const prior = chosen.get(key);
    if (prior) excludedDuplicates.push(prior.reference);
    chosen.set(key, prepared);
  }
  return {
    products: [...chosen.values()],
    excludedBackground,
    excludedDuplicates,
  };
}
