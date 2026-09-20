import jeanImg from "./assets/jean-recto.webp";
import chaquetaImg from "./assets/chaqueta-denim.webp";
import camisaImg from "./assets/camisa-oversize.webp";
import conjuntoImg from "./assets/conjunto-noir.webp";

export type Category = "Jeans" | "Chaquetas" | "Camisas" | "Conjuntos";
export type Gender = "Mujer" | "Hombre" | "Unisex";

export type Product = {
  id: number;
  name: string;
  reference: string;
  brand: string;
  category: Category;
  gender: Gender;
  image: string;
  retail: number;
  wholesale: number;
  minimum: number;
  sizes: string[];
  colors: string[];
  badge?: string;
  description: string;
};

export const products: Product[] = [
  {
    id: 1,
    name: "Jean recto tiro alto",
    reference: "501-JR24",
    brand: "Americanino",
    category: "Jeans",
    gender: "Mujer",
    image: jeanImg,
    retail: 129900,
    wholesale: 94900,
    minimum: 6,
    sizes: ["6", "8", "10", "12", "14"],
    colors: ["Índigo", "Azul medio"],
    badge: "Nuevo",
    description: "Denim rígido de tacto suave, tiro alto y silueta recta que estiliza sin perder comodidad.",
  },
  {
    id: 2,
    name: "Chaqueta denim raw",
    reference: "501-CH09",
    brand: "Wrangler",
    category: "Chaquetas",
    gender: "Hombre",
    image: chaquetaImg,
    retail: 169900,
    wholesale: 124900,
    minimum: 4,
    sizes: ["S", "M", "L", "XL"],
    colors: ["Índigo oscuro"],
    badge: "Top ventas",
    description: "Chaqueta clásica en denim oscuro, costuras en contraste y estructura cómoda para usar todos los días.",
  },
  {
    id: 3,
    name: "Camisa blanca oversize",
    reference: "501-CM18",
    brand: "Studio 501",
    category: "Camisas",
    gender: "Mujer",
    image: camisaImg,
    retail: 89900,
    wholesale: 64900,
    minimum: 6,
    sizes: ["S", "M", "L"],
    colors: ["Blanco", "Negro"],
    description: "Camisa amplia de algodón liviano con caída limpia y un largo ideal para crear looks versátiles.",
  },
  {
    id: 4,
    name: "Set sastre Noir",
    reference: "501-CJ31",
    brand: "Studio 501",
    category: "Conjuntos",
    gender: "Mujer",
    image: conjuntoImg,
    retail: 219900,
    wholesale: 169900,
    minimum: 3,
    sizes: ["S", "M", "L"],
    colors: ["Negro", "Rojo vino"],
    badge: "Exclusivo",
    description: "Conjunto de chaqueta corta y pantalón amplio con una silueta moderna, elegante y fácil de combinar.",
  },
  {
    id: 5,
    name: "Jean wide leg clásico",
    reference: "501-JR38",
    brand: "Levi's",
    category: "Jeans",
    gender: "Mujer",
    image: jeanImg,
    retail: 149900,
    wholesale: 109900,
    minimum: 6,
    sizes: ["6", "8", "10", "12", "14", "16"],
    colors: ["Azul medio", "Negro"],
    badge: "Oferta",
    description: "Pierna amplia, talle favorecedor y denim con la estructura perfecta para looks urbanos.",
  },
  {
    id: 6,
    name: "Chaqueta trucker essential",
    reference: "501-CH12",
    brand: "Americanino",
    category: "Chaquetas",
    gender: "Unisex",
    image: chaquetaImg,
    retail: 159900,
    wholesale: 114900,
    minimum: 4,
    sizes: ["S", "M", "L", "XL"],
    colors: ["Azul oscuro", "Negro"],
    description: "Un básico unisex con corte trucker y acabado oscuro que funciona sobre cualquier look.",
  },
  {
    id: 7,
    name: "Camisa esencial premium",
    reference: "501-CM20",
    brand: "Studio 501",
    category: "Camisas",
    gender: "Mujer",
    image: camisaImg,
    retail: 94900,
    wholesale: 69900,
    minimum: 6,
    sizes: ["S", "M", "L", "XL"],
    colors: ["Blanco", "Arena"],
    badge: "Nuevo",
    description: "Algodón fresco de apariencia pulida y fit relajado para usar abierta, cerrada o anudada.",
  },
  {
    id: 8,
    name: "Conjunto urbano Black",
    reference: "501-CJ35",
    brand: "Studio 501",
    category: "Conjuntos",
    gender: "Mujer",
    image: conjuntoImg,
    retail: 229900,
    wholesale: 174900,
    minimum: 3,
    sizes: ["S", "M", "L"],
    colors: ["Negro"],
    badge: "Pocas unidades",
    description: "Dos piezas de líneas limpias para pasar del día a la noche con actitud y comodidad.",
  },
];

export const categories = [
  { name: "Jeans" as Category, image: jeanImg, eyebrow: "El fit perfecto", count: 28 },
  { name: "Chaquetas" as Category, image: chaquetaImg, eyebrow: "Capas con actitud", count: 16 },
  { name: "Camisas" as Category, image: camisaImg, eyebrow: "Básicos elevados", count: 22 },
  { name: "Conjuntos" as Category, image: conjuntoImg, eyebrow: "Look completo", count: 14 },
];
