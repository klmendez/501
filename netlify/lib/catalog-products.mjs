import bundledProducts from "../../public/catalog-products.json" with { type: "json" };

export const staticProducts = bundledProducts;

export function catalogState(data) {
  if (Array.isArray(data)) return { products: data, deletedReferences: [] };
  return {
    products: Array.isArray(data?.products) ? data.products : [],
    deletedReferences: Array.isArray(data?.deletedReferences) ? data.deletedReferences : [],
  };
}

export function visibleProducts(data) {
  const { products, deletedReferences } = catalogState(data);
  const hidden = new Set(deletedReferences);
  const overridden = new Set(products.map((product) => product.reference));
  return [
    ...products.filter((product) => !hidden.has(product.reference)),
    ...staticProducts.filter((product) => !hidden.has(product.reference) && !overridden.has(product.reference)),
  ];
}
