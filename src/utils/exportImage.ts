import { ExportFormat } from '../types';

function extensionForFormat(format: ExportFormat): string {
  if (format === 'png') {
    return 'png';
  }

  if (format === 'webp') {
    return 'webp';
  }

  return 'jpg';
}

function mimeForFormat(format: ExportFormat): string {
  if (format === 'png') {
    return 'image/png';
  }

  if (format === 'webp') {
    return 'image/webp';
  }

  return 'image/jpeg';
}

export function exportCanvasToBlob(
  canvas: HTMLCanvasElement,
  format: ExportFormat,
  quality = 0.94
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('The browser could not export the image.'));
          return;
        }

        resolve(blob);
      },
      mimeForFormat(format),
      format === 'jpeg' || format === 'webp' ? quality : undefined
    );
  });
}

export function createDownloadFilename(originalName: string, format: ExportFormat): string {
  const strippedName = originalName.replace(/\.[^.]+$/, '') || 'photo';
  return `${strippedName}-watermarked.${extensionForFormat(format)}`;
}

export function triggerDownload(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

export async function shareImageIfPossible(blob: Blob, filename: string): Promise<boolean> {
  if (!('share' in navigator) || !('canShare' in navigator)) {
    return false;
  }

  const file = new File([blob], filename, { type: blob.type });
  if (!navigator.canShare({ files: [file] })) {
    return false;
  }

  await navigator.share({
    files: [file],
    title: 'Watermarked photo'
  });

  return true;
}
