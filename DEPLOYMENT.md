# Despliegue en Cloudflare Pages — MicroCoreOS Docs

Este manual detalla los pasos para compilar y desplegar el sitio de documentación oficial de **MicroCoreOS** (`microcoreos-docs`) en **Cloudflare Pages** usando VitePress y `wrangler`.

---

## 📋 Requisitos Previos

- [Node.js](https://nodejs.org/) v18+
- `pnpm` o `npm`
- Una cuenta activa en [Cloudflare](https://dash.cloudflare.com/)

---

## 🚀 Paso 1: Compilar la Documentación para Producción

Genera los archivos HTML estáticos de VitePress:

```bash
pnpm build
# o con npm:
npm run docs:build
```

Esto creará el directorio **`.vitepress/dist`** con la documentación compilada.

---

## ☁️ Paso 2: Autenticación en Cloudflare (Primera vez)

Si aún no te has autenticado en la máquina:

```bash
npx wrangler login
```

Se abrirá el navegador para aprobar el acceso a la CLI.

---

## ⚡ Paso 3: Despliegue Manual con Wrangler CLI

Despliega el directorio `.vitepress/dist` directamente a Cloudflare Pages:

```bash
npx wrangler pages deploy .vitepress/dist --project-name microcoreos-docs
```

O usando el script definido en `package.json`:

```bash
npm run docs:deploy
```

### Parámetros Explicados:
- `.vitepress/dist`: Carpeta de salida del build de VitePress.
- `--project-name microcoreos-docs`: Nombre del proyecto asignado en Cloudflare Pages.

---

## 🤖 Paso 4: Despliegue Automatizado vía GitHub (Opcional)

Para conectar el repositorio GitHub a Cloudflare Pages y desplegar automáticamente con cada `git push`:

1. Ve a **Cloudflare Dashboard** ➔ **Workers & Pages** ➔ **Create application** ➔ **Pages** ➔ **Connect to Git**.
2. Conecta el repositorio `microcoreos-docs`.
3. Configura los parámetros de build:
   - **Framework preset**: `VitePress` (o `None`)
   - **Build command**: `npm run docs:build`
   - **Build output directory**: `.vitepress/dist`
   - **Environment Variables**:
     - `NODE_VERSION`: `20`
4. Haz clic en **Save and Deploy**.

---

## 🔗 Enlaces y Verificación

- **URL Cloudflare Pages**: `https://microcoreos-docs.pages.dev`
- **Dominio Personalizado**: `https://docs.microcoreos.com`
