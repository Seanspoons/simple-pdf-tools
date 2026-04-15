# Simple PDF Tools

Simple PDF Tools is a privacy-first web app for quick PDF utilities that run entirely in the browser.

Live site: https://simplepdftools.app

Current tool:
- Merge PDF

Planned tools:
- Split PDF
- Compress PDF
- Extract Pages
- Rotate PDF

## What it does

### Merge PDF
- Upload multiple PDF files
- Reorder files before merging
- Remove files you do not want included
- Merge documents locally in the browser
- Download a single combined PDF

## Product direction

This repo started as a clone of Simple Photo Tools and is being converted into a sibling product focused on browser-based PDF utilities.

The current routes are:

- `/`
- `/merge-pdf`
- `/split-pdf`
- `/compress-pdf`
- `/extract-pages`
- `/rotate-pdf`

The homepage acts as a simple tool hub, with Merge PDF as the first real tool and the rest presented as coming soon.

## Privacy

All PDF processing is intended to happen locally in the browser.

- No uploads to our server
- No accounts
- No backend required

## Tech

- React
- TypeScript
- Vite
- `pdf-lib` for browser-side PDF merging
- PWA support for offline app-shell usage

## Reusable UI patterns

To keep layout patterns while removing legacy photo tools, the two-column step layout is now preserved as neutral UI primitives:

- `src/components/layout/TwoColumnToolLayout.tsx`
- `src/styles.css` classes: `tool-two-col-layout`, `tool-main-col`, `tool-side-col`, `tool-sticky-wrap`

These classes are intended for future PDF tools that need a preview/content column and a controls/export column.

## Running locally

Requirements:
- Node.js 20+
- npm

Install:

```bash
npm install
```

Start the dev server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```
