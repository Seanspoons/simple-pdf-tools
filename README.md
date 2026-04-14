# Simple Photo Tools

Simple Photo Tools is a privacy-first web app for quick photo edits that run entirely in the browser.

Live site: https://simplephototools.com

Current tools:
- Photo Watermarker
- Collage Maker
- Image Converter
- Photo Resizer
- Image Compressor
- Crop Tool
- Rotate / Flip
- Social Media Formatter
- Remove Metadata

## What it does

### Photo Watermarker
- Add text or logo watermarks
- Use a single mark or a repeated proof pattern
- Adjust placement, size, color, opacity, shadow, and background styling
- Export as JPEG or PNG

### Collage Maker
- Upload multiple photos
- Arrange and resize tiles directly in the preview
- Export high-quality JPEG or PNG collages

### Image Converter
- Convert images between JPEG, PNG, and WebP
- Open JPEG, PNG, WebP, GIF, BMP, AVIF, SVG, HEIC, and HEIF files locally
- Adjust quality for JPEG and WebP exports
- Fill transparent areas with a chosen background color when saving to JPEG

### Photo Resizer
- Set a new width and height with aspect ratio lock on by default
- Preview the new dimensions before saving
- Export the resized image locally in the browser
- Send the resized result straight into the Image Compressor

### Image Compressor
- Make image files smaller with simple JPEG, PNG, and WebP export options
- Preview the expected file size change before saving
- Handle transparent images cleanly when saving to JPEG
- Export the compressed result locally in the browser

### Crop Tool
- Drag the crop area and resize it with simple corner handles
- Switch between free crop and common aspect ratio presets
- Preview the cropped result before saving
- Export the selected crop locally in the browser

### Rotate / Flip
- Rotate images left or right in simple 90° steps
- Flip images horizontally or vertically with a live preview
- Reset back to the original orientation any time
- Export the final result locally in the browser

### Social Media Formatter
- Pick ready-made presets for Instagram, TikTok, YouTube, LinkedIn, and X
- Choose whether the image should fit inside the canvas or fill it edge to edge
- Add background color and padding when you need extra space around the image
- Export the final social-ready image locally in the browser

### Remove Metadata
- Review grouped metadata like file details, camera info, dates, and location when available
- Create a cleaned copy that does not preserve the original metadata block
- Compare what was found before export and what remains after cleaning
- Export the cleaned image locally in the browser

## Product direction

This project started as a watermarking app and is being expanded into a broader suite of browser-based photo tools. The homepage now acts as a simple tool hub, with dedicated routes for each tool:

- `/`
- `/watermarker`
- `/collage`
- `/convert`
- `/resize`
- `/compress`
- `/crop`
- `/rotate`
- `/social`
- `/metadata`

Additional tools will be added over time.

## Privacy

All image processing happens locally in the browser.

- No uploads to our server
- No accounts
- No backend required
- Drafts and preferences stay on the device

## Tech

- React
- TypeScript
- Vite
- Canvas-based image rendering
- PWA support for offline app-shell usage
- `heic2any` for browser-side HEIC/HEIF conversion

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
- The watermarker supports text, logo, and proof-style marks
- The collage maker is grid-based and intentionally guided rather than fully freeform
- Larger collage grids may need higher export quality on lower-memory devices

## Why I built it

I wanted a fast, simple set of photo tools that:

- work well on mobile and desktop
- are easy for non-technical users
- keep personal photos off random servers
- stay free and lightweight
