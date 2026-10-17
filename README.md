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
- Productos, tallas, colores y marcas: `src/data.ts`
- Identidad visual y responsive: `src/styles.css`
- Textos y estructura de la página: `src/App.tsx`
- Imágenes optimizadas: `src/assets/`

El número de WhatsApp configurado es `573218001878`. Los productos y marcas incluidos funcionan como inventario de muestra y también deben confirmarse con la información real del almacén.

## Funciones incluidas

- páginas independientes: `/`, `/catalogo`, `/mayoristas` y `/contacto`;
- selector de consulta al detal o mayorista;
- catálogo con búsqueda y filtros por categoría, marca, género, talla y color;
- favoritos y vista rápida;
- pedido con cantidades y enlaces a cada producto;
- consultas por WhatsApp con nombre, referencia y enlace directo al producto;
- navegación inferior y paneles táctiles en móvil;
- diseño adaptable probado desde 320 px hasta escritorio.

## Carga masiva de productos

Para guardar los productos en PostgreSQL de Supabase y las fotos en Cloudflare R2, sigue la [guía de conexión](docs/SUPABASE.md). El panel `/admin` funciona con Netlify Blobs hasta configurar los servicios.

1. Abre `/admin` en el sitio y selecciona varias fotos JPG, PNG o WebP (hasta 15 MB cada una).
2. La página sugiere grupos por nombre de archivo y parecido visual. Revisa cada grupo: puedes mover fotos, separarlas y elegir la portada.
3. Completa nombre, referencia única, marca, categoría, tallas, colores y demás datos. Pulsa **Publicar productos** para mostrarlos directamente en la tienda.
4. Si quieres un respaldo, pulsa **Descargar respaldo**. Ese archivo también se puede importar en este proyecto con `npm run import:catalog -- ruta/al/archivo-descargado.json` y volver a desplegar el sitio.

El catálogo publicado muestra las nuevas referencias y sus fotos con fondo blanco. El panel reduce automáticamente las imágenes a un máximo de 1200 píxeles y las convierte a WebP al subirlas. Si vuelves a publicar una referencia, se actualiza ese producto. Los grupos son sugerencias: confirma siempre que las fotos correspondan a la misma prenda.

En **Productos** dentro de `/admin` puedes buscar y editar cualquier referencia visible en la tienda, tanto las cargadas desde el panel como las incluidas en `public/catalog-products.json`. Puedes cambiar sus datos, agregar o reordenar fotos y retirarlas. Los cambios hechos en el panel prevalecen sobre el catálogo incluido en el proyecto; una referencia retirada no reaparece al recargar. Sin configurar los servicios, productos y fotos subidas se guardan en Netlify Blobs. Con Supabase y R2 activados, el catálogo se guarda en PostgreSQL y las fotos nuevas en R2. Al guardar o eliminar, las fotos subidas al panel que ya no usa ningún producto se borran de su almacenamiento.

El panel `/admin` tiene un resumen del catálogo, una lista de productos, carga masiva y promociones. En **Promociones** puedes crear banners para la portada o destacar productos visibles, activar y pausar cada campaña, y editar su texto. La foto se toma del producto seleccionado, por lo que no se almacena una copia adicional. Las cifras del resumen son productos, fotos, categorías y campañas activas; no representan visitas ni ventas por WhatsApp.

### Configuración de Netlify

En el proyecto `501m` de Netlify, crea la variable de entorno `CATALOG_ADMIN_PASSWORD` con una clave larga y privada (mínimo 16 caracteres recomendado), disponible para **Functions**, y haz un nuevo despliegue. No guardes la clave en el repositorio ni como variable `VITE_`: `/admin` la envía por HTTPS a la función y la mantiene solo en memoria durante la sesión. Las nuevas publicaciones aparecen sin hacer otro despliegue. Las funciones están en `netlify/functions/`. Para activar Supabase y R2, añade también las variables de la [guía de conexión](docs/SUPABASE.md).

Para probar el administrador sin clave en tu computador, ejecuta `npm run dev` y abre `http://localhost:5173/admin`. Ese comando inicia la tienda y las funciones de Netlify; Netlify Blobs usa un almacén local de prueba. Si ya tienes abierto el servidor anterior, detenlo con Ctrl+C antes de volver a ejecutar el comando. En la URL pública `501m.netlify.app`, la publicación sigue bloqueada hasta configurar `CATALOG_ADMIN_PASSWORD`.

## Revisión de una carpeta de fotos

Para preparar una carpeta local sin modificar las fotos originales:

```powershell
python -m pip install Pillow
python scripts/prepare-products.py 'D:\W\501\PRODUCTOS'
```

El proceso crea `_revision_501/` dentro de la carpeta con un inventario, hojas de contacto, fichas preliminares y `revisar.html`. Abre esta última página en el navegador para corregir textos, marcas y agrupaciones; luego descarga `fichas-revisadas-501.json`. Ese JSON es un borrador de revisión, no un archivo de importación del administrador. Las referencias `REV-` son provisionales. Confirma tallas, marcas, referencias y fotos antes de publicar.

### Visión de productos por lote

El comando `scripts/product-vision.py` analiza fotos locales, conserva los originales y genera `_vision_501/comparar.html` para revisar originales, mejoras y recortes. Usa U²-Net para segmentación, MobileNet para representación visual, un promedio ponderado de similitud para sugerir grupos y OCR opcional para marcas. Las sugerencias nunca se publican automáticamente.

```powershell
python -m venv 'D:\W\501\.venv-product-vision' --system-site-packages
& 'D:\W\501\.venv-product-vision\Scripts\python.exe' -m pip install -r scripts/requirements-product-vision.txt
& 'D:\W\501\.venv-product-vision\Scripts\python.exe' scripts/product-vision.py 'D:\W\501\PRODUCTOS' --limit 12 --ocr
```

Quita `--limit 12` para procesar toda la carpeta. El primer uso descarga modelos y puede tardar varios minutos. Las imágenes procesadas quedan en `_vision_501/mejoradas`, `sin_fondo` y `fondo_blanco`; `vision-report.json` conserva las evidencias y puntuaciones. Se utiliza explícitamente U²-Net: el modelo predeterminado de rembg tiene restricciones de licencia comercial.

Para comparar logos y coincidencias web con Google Cloud Vision, instala `google-cloud-vision`, configura `GOOGLE_APPLICATION_CREDENTIALS` y añade `--google-vision`. Esta opción envía las fotos a Google y puede generar cargos. La detección de logos o coincidencias web solo propone una marca; no prueba autenticidad ni referencia comercial.
