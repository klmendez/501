# 501 — catálogo web

Catálogo mobile-first de moda urbana, con experiencias separadas para compra al detal y al por mayor.

## Ejecutar

```bash
npm install
npm run dev
```

Para generar la versión de producción:

```bash
npm run build
npm run preview
```

## Personalización

- Número de WhatsApp: `src/config.ts`
- Productos, precios, tallas, colores y marcas: `src/data.ts`
- Identidad visual y responsive: `src/styles.css`
- Textos y estructura de la página: `src/App.tsx`
- Imágenes optimizadas: `src/assets/`

El número de WhatsApp incluido es temporal (`573000000000`) y debe reemplazarse antes de publicar. Los productos y marcas incluidos funcionan como inventario de muestra y también deben confirmarse con la información real del almacén.

## Funciones incluidas

- páginas independientes: `/`, `/catalogo`, `/mayoristas` y `/contacto`;
- selector de precio detal/mayorista;
- catálogo con búsqueda y filtros por categoría, marca, género, talla, color y precio;
- favoritos y vista rápida;
- pedido con cantidades y total estimado;
- cotización preparada para WhatsApp;
- navegación inferior y paneles táctiles en móvil;
- diseño adaptable probado desde 320 px hasta escritorio.
