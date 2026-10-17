export type Category = "Jeans" | "Chaquetas" | "Camisas" | "Conjuntos" | "Buzos" | "Bermudas" | "Camisetas";
export type Gender = "Mujer" | "Hombre" | "Unisex";

export type Product = {
  id: number;
  name: string;
  reference: string;
  brand: string;
  category: Category;
  gender: Gender;
  image: string;
  images?: string[];
  minimum: number;
  sizes: string[];
  colors: string[];
  badge?: string;
  description: string;
};

// Las prendas reales se cargan desde public/catalog-products.json y el catálogo en vivo.
export const products: Product[] = [];

export const categories: { name: Category; reference: string; image: string; eyebrow: string }[] = [
  { name: "Jeans", reference: "501-FOTO-001", image: "/productos-501/001-marca-por-confirmar-negro-modelo.webp", eyebrow: "El fit perfecto" },
  { name: "Chaquetas", reference: "501-FOTO-029", image: "/productos-501/029-columbia-azul-rey-modelo.webp", eyebrow: "Capas con actitud" },
  { name: "Camisas", reference: "501-FOTO-012", image: "/productos-501/012-marca-por-confirmar-verde-modelo.webp", eyebrow: "Básicos elevados" },
  { name: "Conjuntos", reference: "501-FOTO-009", image: "/productos-501/009-marca-por-confirmar-blanco-modelo.webp", eyebrow: "Look completo" },
  { name: "Buzos", reference: "501-FOTO-063", image: "/productos-501/063-diesel-negro-modelo.webp", eyebrow: "Comodidad urbana" },
  { name: "Bermudas", reference: "501-FOTO-016", image: "/productos-501/016-dsquared2-negro-modelo.webp", eyebrow: "Movimiento libre" },
  { name: "Camisetas", reference: "501-FOTO-087", image: "/productos-501/087-philipp-plein-blanco-modelo.webp", eyebrow: "Todos los días" },
];
