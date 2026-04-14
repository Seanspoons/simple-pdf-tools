const HEIC_EXTENSIONS = new Set(['heic', 'heif']);

export function isHeicFile(file: File): boolean {
  const lowerName = file.name.toLowerCase();
  const extension = lowerName.includes('.') ? lowerName.split('.').pop() : '';
  return (
    file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    extension === 'heic' ||
    extension === 'heif' ||
    (extension !== undefined && HEIC_EXTENSIONS.has(extension))
  );
}

export async function convertHeicToJpeg(file: File): Promise<File> {
  const { default: heic2any } = await import('heic2any');
  const result = await heic2any({
    blob: file,
    toType: 'image/jpeg',
    quality: 0.95
  });

  const outputBlob = Array.isArray(result) ? result[0] : result;
  if (!(outputBlob instanceof Blob)) {
    throw new Error('The HEIC conversion did not return an image blob.');
  }

  const baseName = file.name.replace(/\.(heic|heif)$/i, '') || 'converted-photo';
  return new File([outputBlob], `${baseName}.jpg`, {
    type: 'image/jpeg'
  });
}
