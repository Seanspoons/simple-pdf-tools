# Simple PDF Tools

Simple PDF Tools is a privacy-first web app for quick PDF utilities that run entirely in the browser.

Live site: https://simplepdftools.app

Current tools:

- Merge PDF
- Split PDF

Planned tools:

- Compress PDF
- Extract Pages
- Rotate PDF

## What it does

### Merge PDF

- Upload multiple PDF files
- Preview the first page of each file before export
- Reorder files with drag and drop
- Rotate files before merging when needed
- Remove files you do not want included
- Export one merged PDF locally in the browser

### Split PDF

- Upload one PDF and preview its pages directly in the browser
- Extract selected pages into one new PDF
- Split every page into separate PDF files
- Split by page ranges with guided range inputs
- Review grouped range output before export
- Export the resulting PDFs locally in the browser

## Product direction

This project started as a sibling product to Simple Photo Tools and is being built into a broader suite of browser-based PDF utilities.

The homepage acts as a simple tool hub, with dedicated routes for each tool:

- `/`
- `/merge-pdf`
- `/split-pdf`
- `/compress-pdf`
- `/extract-pages`
- `/rotate-pdf`

Merge PDF and Split PDF are live now. Additional PDF tools will be added over time.

## Privacy

All PDF processing happens locally in the browser.

- No uploads to our server
- No accounts
- No backend required
- Drafts and preferences stay on the device

## Tech

- React
- TypeScript
- Vite
- `pdf-lib` for browser-side PDF generation and document assembly
- `pdfjs-dist` for PDF preview rendering
- PWA support for offline app-shell usage

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

## Notes

- The app works offline after the initial load
- Merge PDF supports draft restoration, page preview thumbnails, file rotation, and drag-and-drop ordering
- Split PDF supports selected pages, every-page export, and grouped page-range export
- Larger PDFs may take longer to preview on lower-memory devices because rendering happens in the browser

## Why I built it

I wanted a fast, simple set of PDF tools that:

- work well on mobile and desktop
- are easy for non-technical users
- keep sensitive documents off random servers
- stay free and lightweight
