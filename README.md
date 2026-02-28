# MicroCoreOS Documentation

This repository contains the official documentation for **MicroCoreOS**, built with [VitePress](https://vitepress.dev).

MicroCoreOS is an Atomic Microkernel Architecture optimized for AI-Driven Development.

## 🚀 Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) (version 18 or higher recommended)
- npm or pnpm

### Local Development

1. Install the dependencies:

   ```bash
   npm install
   ```

2. Start the local development server:

   ```bash
   npm run docs:dev
   ```

   The documentation will be available at `http://localhost:5173`.

### Building for Production

To generate the static HTML files:

```bash
npm run docs:build
```

The compiled files will be created in the `.vitepress/dist` directory.

### Preview Production Build

To preview the generated static files locally before deploying:

```bash
npm run docs:preview
```

## ☁️ Deployment

This project is configured to be deployed on **Cloudflare Pages**.

### Manual Deployment via CLI

You can build and deploy the site directly from your terminal using the following command:

```bash
npm run docs:deploy
```

*Note: This command runs `vitepress build` followed by `wrangler pages deploy`.*

### Automated Deployment (GitHub + Cloudflare)

The recommended approach is to connect this repository to Cloudflare Pages:

1. Push your changes to the `main` branch on GitHub.
2. In the Cloudflare Pages dashboard, connect your Git repository.
3. Configure the build settings:
   - **Framework preset:** `None` (or `VitePress`)
   - **Build command:** `npm run docs:build`
   - **Build output directory:** `.vitepress/dist`
4. Set an environment variable for a recent Node version:
   - `NODE_VERSION`: `20`

Cloudflare will automatically deploy your documentation every time you push to the `main` branch.

## 📁 Repository Structure

- `/guide`: Core documentation, philosophy, and quick start guides.
- `/development`: Instructions for creating plugins, tools, and testing.
- `/reference`: API references, tools inventory, and AI native design details.
- `/.vitepress`: VitePress configuration files (`config.mts`) and theme adjustments.

## 📄 License

This documentation is released under the [MIT License](https://opensource.org/licenses/MIT).

Copyright © 2024-present AnibalOS.
