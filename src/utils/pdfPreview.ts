import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

export type PreviewOrientation = 'portrait' | 'landscape';

export type PdfPagePreview = {
  pageNumber: number;
  previewUrl: string | null;
  previewOrientation: PreviewOrientation;
};

type PreviewSize = {
  maxWidth?: number;
  maxHeight?: number;
  maxScale?: number;
};

async function openPdfDocument(file: File) {
  const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

  const bytes = new Uint8Array(await file.arrayBuffer());

  return getDocument({
    data: bytes,
    useWorkerFetch: false,
    isEvalSupported: false
  }).promise;
}

async function renderSinglePage(
  pdf: Awaited<ReturnType<typeof openPdfDocument>>,
  pageNumber: number,
  size: Required<PreviewSize>
): Promise<PdfPagePreview> {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1 });
  const previewOrientation: PreviewOrientation =
    viewport.width > viewport.height ? 'landscape' : 'portrait';
  const scale = Math.min(size.maxWidth / viewport.width, size.maxHeight / viewport.height, size.maxScale);
  const scaledViewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('The browser could not prepare a PDF preview.');
  }

  let previewUrl: string | null = null;

  try {
    canvas.width = Math.ceil(scaledViewport.width);
    canvas.height = Math.ceil(scaledViewport.height);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
      canvas,
      canvasContext: context,
      viewport: scaledViewport
    }).promise;

    previewUrl = canvas.toDataURL('image/png');
  } catch {
    previewUrl = null;
  }

  return {
    pageNumber,
    previewUrl,
    previewOrientation
  };
}

export async function renderPdfPagePreviews(
  file: File,
  pageNumbers: number[],
  size: PreviewSize = {}
): Promise<{ pageCount: number; previews: PdfPagePreview[] }> {
  const pdf = await openPdfDocument(file);
  const resolvedSize: Required<PreviewSize> = {
    maxWidth: size.maxWidth ?? 240,
    maxHeight: size.maxHeight ?? 320,
    maxScale: size.maxScale ?? 1.5
  };

  try {
    const previews: PdfPagePreview[] = [];

    for (const pageNumber of pageNumbers) {
      if (pageNumber < 1 || pageNumber > pdf.numPages) {
        continue;
      }

      previews.push(await renderSinglePage(pdf, pageNumber, resolvedSize));
    }

    return {
      pageCount: pdf.numPages,
      previews
    };
  } finally {
    await pdf.destroy();
  }
}

export async function renderPdfFirstPagePreview(
  file: File,
  size?: PreviewSize
): Promise<{ pageCount: number; previewUrl: string | null; previewOrientation: PreviewOrientation }> {
  const { pageCount, previews } = await renderPdfPagePreviews(file, [1], size);
  const firstPage = previews[0];

  return {
    pageCount,
    previewUrl: firstPage?.previewUrl ?? null,
    previewOrientation: firstPage?.previewOrientation ?? 'portrait'
  };
}
