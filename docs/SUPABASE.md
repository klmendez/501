# Catálogo en Supabase y fotografías en Cloudflare R2

El panel `/admin` puede guardar los productos en PostgreSQL de Supabase y subir las fotografías a Cloudflare R2. Las claves se usan solo en las funciones de Netlify. Sin variables nuevas, el catálogo y las fotos siguen en Netlify Blobs; configura ambos servicios antes de activar la tienda pública.

## 1. Crear Supabase

1. Crea un proyecto en [Supabase](https://supabase.com/dashboard).
2. En **SQL Editor**, ejecuta [schema.sql](../supabase/schema.sql). Esto crea `catalog_state` y la función `catalog_save`.
3. Copia **Project URL** y la clave privada **secret API key** (`sb_secret_...`).

## 2. Crear Cloudflare R2

1. En Cloudflare, abre **R2 Object Storage** y crea un bucket de clase **Standard**, por ejemplo `catalogo-501`.
2. Asocia un dominio público al bucket, por ejemplo `https://fotos.tudominio.com`. Usa esa URL como `R2_PUBLIC_URL`, sin `/catalog` al final. Para pruebas puedes activar `r2.dev`, pero [Cloudflare recomienda un dominio personalizado para producción](https://developers.cloudflare.com/r2/buckets/public-buckets/).
3. Crea unas credenciales de **R2 API Token** con permiso de lectura y escritura de objetos limitado a ese bucket. Copia el **Access Key ID** y **Secret Access Key**. Copia también el **Account ID** de Cloudflare.

El bucket debe poder **servir** fotos públicamente; las credenciales de escritura permanecen privadas en el servidor. No configures permisos de escritura pública. El panel envía la imagen a Netlify, que la sube a R2. No hace falta CORS para esa ruta.

## 3. Migrar los productos y las fotos existentes

El origen debe tener disponible `/.netlify/functions/admin?action=list` para incluir también los productos agregados desde `/admin`. Si el sitio publicado todavía no tiene esa función, inicia `npm run dev` en otra terminal y usa `http://localhost:5173` como `CATALOG_SOURCE_URL`. Comprueba antes que el catálogo local incluya todos los productos que quieres publicar. **No despliegues el código con las nuevas variables antes de poblar Supabase**, porque la tienda leería un catálogo vacío.

En PowerShell, define las variables en tu sesión local. No las pegues en un chat ni en archivos versionados:

Si Codex va a ejecutar la migración en tu equipo, crea un archivo local a partir de [.env.migration.example](../.env.migration.example):

```powershell
Copy-Item .env.migration.example .env.migration.local
code .env.migration.local
```

Reemplaza los siete valores de Supabase y R2. Deja `CATALOG_SOURCE_URL=http://localhost:5173` si el servidor local contiene todo el catálogo. Guarda el archivo. Está ignorado por Git y Codex podrá ejecutar `node --env-file=.env.migration.local scripts/migrate-to-supabase.mjs` (y agregar `--apply` para migrar). Bórralo después de verificar el despliegue. **No envíes las claves por chat ni capturas donde aparezcan.**

```powershell
$env:SUPABASE_URL = 'https://TU-PROYECTO.supabase.co'
$env:SUPABASE_SECRET_KEY = 'sb_secret_TU_CLAVE'
$env:R2_ACCOUNT_ID = 'TU_ACCOUNT_ID'
$env:R2_ACCESS_KEY_ID = 'TU_ACCESS_KEY_ID'
$env:R2_SECRET_ACCESS_KEY = 'TU_SECRET_ACCESS_KEY'
$env:R2_BUCKET = 'catalogo-501'
$env:R2_PUBLIC_URL = 'https://fotos.tudominio.com'
$env:CATALOG_SOURCE_URL = 'http://localhost:5173'
$env:CATALOG_ADMIN_PASSWORD = 'TU_CLAVE_ADMIN'
npm run migrate:supabase
```

`CATALOG_SOURCE_URL` incluye las publicaciones de `/admin` y permite descargar sus fotos actuales desde Netlify Blobs. Si el sitio publicado sí tiene la función de administración y es la fuente correcta, usa su dominio en vez de `localhost`. Si omites la variable, se migrarán solo los productos de `public/catalog-products.json`. El comando sin `--apply` solo muestra el recuento.

Tras revisar el recuento, ejecuta:

```powershell
npm run migrate:supabase -- --apply
```

El script conserva solo una foto con fondo blanco por producto, excluye los productos sin esa foto, elimina referencias repetidas por nombre, marca, categoría, género y color, y reduce las fotos a un máximo de 1200 píxeles antes de subirlas a R2. Después cambia sus URL y guarda el catálogo en Supabase. Puede reintentarse si se interrumpe antes de guardar el catálogo; reconoce las fotos ya copiadas. Se detiene si Supabase ya tiene productos para evitar sobrescribir cambios. Verifica que una URL `R2_PUBLIC_URL/catalog/...` abra una foto antes de activar las variables en Netlify.

## 4. Activar el sitio

Configura estas variables en Netlify con alcance **Functions** y despliega de nuevo:

| Variable | Valor |
| --- | --- |
| `SUPABASE_URL` | URL del proyecto |
| `SUPABASE_SECRET_KEY` | Clave privada `sb_secret_...` |
| `R2_ACCOUNT_ID` | ID de cuenta de Cloudflare |
| `R2_ACCESS_KEY_ID` | Access Key ID del token R2 |
| `R2_SECRET_ACCESS_KEY` | Secret Access Key del token R2 |
| `R2_BUCKET` | Nombre del bucket, por ejemplo `catalogo-501` |
| `R2_PUBLIC_URL` | URL pública del bucket, sin barra final |
| `CATALOG_ADMIN_PASSWORD` | Clave privada de `/admin` |

No uses el prefijo `VITE_` para las claves. Después del despliegue, sube un producto desde `/admin` y comprueba la foto en la tienda. Las promociones siguen almacenadas en Netlify Blobs. Conserva las imágenes de `public/productos-501/` hasta confirmar que todos los productos usan las nuevas URL.

**Costo:** la [capa gratuita de R2 Standard](https://developers.cloudflare.com/r2/pricing/) incluye 10 GB-mes de almacenamiento, 1 millón de operaciones de clase A y 10 millones de clase B por mes. Superar esos límites puede generar cargos. El panel acepta fotos con fondo blanco, las reduce a un máximo de 1200 píxeles y las convierte a WebP antes de subirlas. El catálogo usa carga diferida.
