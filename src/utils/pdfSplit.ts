export type SplitRange = {
  start: number;
  end: number;
};

export function getPdfBaseName(file: File): string {
  return file.name.replace(/\.pdf$/i, '') || 'pdf';
}

export function parseSplitRanges(value: string, pageCount: number): {
  ranges: SplitRange[];
  error: string | null;
} {
  const tokens = value
    .split(/[\n,]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (tokens.length === 0) {
    return {
      ranges: [],
      error: 'Add one or more page ranges like 1-3 or 4-6.'
    };
  }

  const ranges: SplitRange[] = [];

  for (const token of tokens) {
    const match = token.match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match) {
      return {
        ranges: [],
        error: `Could not read "${token}". Use values like 1-3 or 4.`
      };
    }

    const start = Number(match[1]);
    const end = Number(match[2] ?? match[1]);

    if (start < 1 || end < 1 || start > pageCount || end > pageCount) {
      return {
        ranges: [],
        error: `Page ranges must stay between 1 and ${pageCount}.`
      };
    }

    if (start > end) {
      return {
        ranges: [],
        error: `Range "${token}" runs backwards.`
      };
    }

    ranges.push({ start, end });
  }

  return { ranges, error: null };
}

export async function createPdfBlobFromPageNumbers(file: File, pageNumbers: number[]): Promise<Blob> {
  const { PDFDocument } = await import('pdf-lib');
  const sourceBytes = await file.arrayBuffer();
  const sourcePdf = await PDFDocument.load(sourceBytes);
  const nextPdf = await PDFDocument.create();
  const zeroBasedPages = pageNumbers.map((pageNumber) => pageNumber - 1);
  const copiedPages = await nextPdf.copyPages(sourcePdf, zeroBasedPages);
  copiedPages.forEach((page) => nextPdf.addPage(page));
  const bytes = await nextPdf.save();

  return new Blob([bytes.slice().buffer], { type: 'application/pdf' });
}

export async function downloadBlobSequence(files: Array<{ blob: Blob; filename: string }>): Promise<void> {
  for (const file of files) {
    const objectUrl = URL.createObjectURL(file.blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = file.filename;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    await new Promise((resolve) => window.setTimeout(resolve, 160));
  }
}

export function buildSelectedPagesFilename(file: File): string {
  return `${getPdfBaseName(file)}-selected-pages.pdf`;
}

export function buildSinglePageFilename(file: File, pageNumber: number): string {
  return `${getPdfBaseName(file)}-page-${pageNumber}.pdf`;
}

export function buildRangeFilename(file: File, range: SplitRange): string {
  if (range.start === range.end) {
    return buildSinglePageFilename(file, range.start);
  }

  return `${getPdfBaseName(file)}-pages-${range.start}-${range.end}.pdf`;
}
