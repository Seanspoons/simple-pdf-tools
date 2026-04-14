import {
  RenderWatermarkOptions,
  WatermarkPosition,
  WatermarkProofAngle,
  WatermarkSettings
} from '../types';

const MIN_FONT_SIZE = 14;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getFontSize(width: number, height: number, settings: WatermarkSettings): number {
  const shorterEdge = Math.min(width, height);
  const scaledSize = (shorterEdge * settings.size) / 100;
  return clamp(Math.round(scaledSize), MIN_FONT_SIZE, Math.round(shorterEdge * 0.2));
}

function getMargin(width: number, height: number, settings: WatermarkSettings): number {
  const shorterEdge = Math.min(width, height);
  return Math.round((shorterEdge * settings.margin) / 100);
}

function getProofGap(width: number, height: number, settings: WatermarkSettings): number {
  const shorterEdge = Math.min(width, height);
  return Math.round((shorterEdge * settings.proofGap) / 120);
}

function getProofAngle(angle: WatermarkProofAngle): number {
  switch (angle) {
    case 'horizontal':
      return 0;
    case 'reverse-diagonal':
      return (-35 * Math.PI) / 180;
    case 'diagonal':
    default:
      return (35 * Math.PI) / 180;
  }
}

function getFontFamily(settings: WatermarkSettings): string {
  return settings.fontFamily === 'Roboto'
    ? '"Roboto", "Segoe UI", Arial, sans-serif'
    : settings.fontFamily === 'Playwrite US Trad'
      ? '"Playwrite US Trad", cursive'
      : settings.fontFamily;
}

function getTextCoordinates(
  position: WatermarkPosition,
  canvasWidth: number,
  canvasHeight: number,
  margin: number,
  textWidth: number,
  textHeight: number
): { x: number; y: number; align: CanvasTextAlign; baseline: CanvasTextBaseline } {
  switch (position) {
    case 'top-left':
      return { x: margin, y: margin, align: 'left', baseline: 'top' };
    case 'top-center':
      return {
        x: (canvasWidth - textWidth) / 2,
        y: margin,
        align: 'left',
        baseline: 'top'
      };
    case 'top-right':
      return {
        x: canvasWidth - margin - textWidth,
        y: margin,
        align: 'left',
        baseline: 'top'
      };
    case 'center-left':
      return {
        x: margin,
        y: (canvasHeight - textHeight) / 2,
        align: 'left',
        baseline: 'top'
      };
    case 'center':
      return {
        x: (canvasWidth - textWidth) / 2,
        y: (canvasHeight - textHeight) / 2,
        align: 'left',
        baseline: 'top'
      };
    case 'center-right':
      return {
        x: canvasWidth - margin - textWidth,
        y: (canvasHeight - textHeight) / 2,
        align: 'left',
        baseline: 'top'
      };
    case 'bottom-left':
      return {
        x: margin,
        y: canvasHeight - margin - textHeight,
        align: 'left',
        baseline: 'top'
      };
    case 'bottom-center':
      return {
        x: (canvasWidth - textWidth) / 2,
        y: canvasHeight - margin - textHeight,
        align: 'left',
        baseline: 'top'
      };
    case 'bottom-right':
      return {
        x: canvasWidth - margin - textWidth,
        y: canvasHeight - margin - textHeight,
        align: 'left',
        baseline: 'top'
      };
  }
}

function getImageSize(
  canvasWidth: number,
  canvasHeight: number,
  settings: WatermarkSettings,
  imageWidth: number,
  imageHeight: number
): { width: number; height: number } {
  const shorterEdge = Math.min(canvasWidth, canvasHeight);
  const targetSize = clamp(
    Math.round((shorterEdge * settings.size) / 100),
    MIN_FONT_SIZE,
    Math.round(shorterEdge * 0.35)
  );
  const scale = targetSize / Math.max(imageWidth, imageHeight);

  return {
    width: Math.max(1, Math.round(imageWidth * scale)),
    height: Math.max(1, Math.round(imageHeight * scale))
  };
}

function applyShadow(context: CanvasRenderingContext2D, intensity: number): void {
  context.shadowColor = 'rgba(0, 0, 0, 0.45)';
  context.shadowBlur = Math.max(4, intensity * 0.25);
  context.shadowOffsetX = Math.max(1, Math.round(intensity * 0.08));
  context.shadowOffsetY = Math.max(1, Math.round(intensity * 0.08));
}

function createTextStampCanvas(
  settings: WatermarkSettings,
  text: string,
  fontSize: number
): { canvas: HTMLCanvasElement; width: number; height: number } {
  const stampCanvas = document.createElement('canvas');
  const stampContext = stampCanvas.getContext('2d');
  if (!stampContext) {
    throw new Error('Canvas rendering is not available in this browser.');
  }

  const fontWeight = settings.bold ? '700' : '400';
  const fontFamily = getFontFamily(settings);
  stampContext.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  stampContext.textAlign = 'left';
  stampContext.textBaseline = 'alphabetic';

  const metrics = stampContext.measureText(text);
  const left = metrics.actualBoundingBoxLeft || 0;
  const right = metrics.actualBoundingBoxRight || metrics.width;
  const ascent = metrics.actualBoundingBoxAscent || fontSize * 0.8;
  const descent = metrics.actualBoundingBoxDescent || fontSize * 0.2;
  const textWidth = left + right;
  const textHeight = ascent + descent;
  const paddingX = settings.showBackground ? Math.round(fontSize * 0.35) : 0;
  const paddingY = settings.showBackground ? Math.round(fontSize * 0.2) : 0;
  const radius = Math.round(fontSize * 0.35);

  stampCanvas.width = Math.ceil(textWidth + paddingX * 2);
  stampCanvas.height = Math.ceil(textHeight + paddingY * 2);

  stampContext.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  stampContext.textAlign = 'left';
  stampContext.textBaseline = 'alphabetic';

  if (settings.showBackground) {
    stampContext.fillStyle = 'rgba(0, 0, 0, 0.28)';
    stampContext.beginPath();
    stampContext.roundRect(0, 0, stampCanvas.width, stampCanvas.height, radius);
    stampContext.fill();
  }

  if (settings.shadow) {
    applyShadow(stampContext, fontSize);
  }

  stampContext.fillStyle = settings.color;
  stampContext.fillText(text, paddingX + left, paddingY + ascent);

  return {
    canvas: stampCanvas,
    width: stampCanvas.width,
    height: stampCanvas.height
  };
}

function drawSingleTextWatermark(
  context: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  settings: WatermarkSettings,
  text: string
): void {
  const fontSize = getFontSize(canvasWidth, canvasHeight, settings);
  const fontWeight = settings.bold ? '700' : '400';
  const fontFamily = getFontFamily(settings);
  context.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  context.textAlign = 'left';
  context.textBaseline = 'alphabetic';

  const metrics = context.measureText(text);
  const left = metrics.actualBoundingBoxLeft || 0;
  const right = metrics.actualBoundingBoxRight || metrics.width;
  const ascent = metrics.actualBoundingBoxAscent || fontSize * 0.8;
  const descent = metrics.actualBoundingBoxDescent || fontSize * 0.2;
  const textWidth = left + right;
  const textHeight = ascent + descent;
  const margin = getMargin(canvasWidth, canvasHeight, settings);
  const { x: textBoxX, y: textBoxY } = getTextCoordinates(
    settings.position,
    canvasWidth,
    canvasHeight,
    margin,
    textWidth,
    textHeight
  );
  const textX = textBoxX + left;
  const textY = textBoxY + ascent;

  if (settings.showBackground) {
    const paddingX = Math.round(fontSize * 0.35);
    const paddingY = Math.round(fontSize * 0.2);
    const radius = Math.round(fontSize * 0.35);
    context.fillStyle = 'rgba(0, 0, 0, 0.28)';
    context.beginPath();
    context.roundRect(
      textBoxX - paddingX,
      textBoxY - paddingY,
      textWidth + paddingX * 2,
      textHeight + paddingY * 2,
      radius
    );
    context.fill();
  }

  if (settings.shadow) {
    applyShadow(context, fontSize);
  }

  context.fillStyle = settings.color;
  context.fillText(text, textX, textY);
}

function drawSingleImageWatermark(
  context: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  settings: WatermarkSettings,
  watermarkImage: HTMLImageElement
): void {
  const imageSize = getImageSize(
    canvasWidth,
    canvasHeight,
    settings,
    watermarkImage.naturalWidth,
    watermarkImage.naturalHeight
  );
  const margin = getMargin(canvasWidth, canvasHeight, settings);
  const { x, y } = getTextCoordinates(
    settings.position,
    canvasWidth,
    canvasHeight,
    margin,
    imageSize.width,
    imageSize.height
  );

  if (settings.shadow) {
    applyShadow(context, Math.max(imageSize.width, imageSize.height));
  }

  context.drawImage(watermarkImage, x, y, imageSize.width, imageSize.height);
}

function drawProofTextWatermark(
  context: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  settings: WatermarkSettings,
  text: string
): void {
  const fontSize = getFontSize(canvasWidth, canvasHeight, settings);
  const stamp = createTextStampCanvas(settings, text, fontSize);
  const gap = getProofGap(canvasWidth, canvasHeight, settings);
  const stepX = stamp.width + gap;
  const stepY = stamp.height + Math.round(gap * 0.85);
  const diagonal = Math.ceil(Math.hypot(canvasWidth, canvasHeight));
  const angle = getProofAngle(settings.proofAngle);
  context.save();
  context.translate(canvasWidth / 2, canvasHeight / 2);
  context.rotate(angle);

  if (settings.shadow) {
    applyShadow(context, Math.max(stamp.width, stamp.height));
  }

  for (let y = -diagonal; y <= diagonal; y += stepY) {
    for (let x = -diagonal; x <= diagonal; x += stepX) {
      context.drawImage(
        stamp.canvas,
        x - stamp.width / 2,
        y - stamp.height / 2,
        stamp.width,
        stamp.height
      );
    }
  }

  context.restore();
}

function drawProofImageWatermark(
  context: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  settings: WatermarkSettings,
  watermarkImage: HTMLImageElement
): void {
  const imageSize = getImageSize(
    canvasWidth,
    canvasHeight,
    settings,
    watermarkImage.naturalWidth,
    watermarkImage.naturalHeight
  );
  const gap = getProofGap(canvasWidth, canvasHeight, settings);
  const stepX = imageSize.width + gap;
  const stepY = imageSize.height + Math.round(gap * 0.85);
  const diagonal = Math.ceil(Math.hypot(canvasWidth, canvasHeight));

  context.save();
  context.translate(canvasWidth / 2, canvasHeight / 2);
  context.rotate(getProofAngle(settings.proofAngle));

  if (settings.shadow) {
    applyShadow(context, Math.max(imageSize.width, imageSize.height));
  }

  for (let y = -diagonal; y <= diagonal; y += stepY) {
    for (let x = -diagonal; x <= diagonal; x += stepX) {
      context.drawImage(
        watermarkImage,
        x - imageSize.width / 2,
        y - imageSize.height / 2,
        imageSize.width,
        imageSize.height
      );
    }
  }

  context.restore();
}

export function renderWatermarkedImage({
  canvas,
  image,
  watermarkImage = null,
  width,
  height,
  settings
}: RenderWatermarkOptions): void {
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas rendering is not available in this browser.');
  }

  canvas.width = width;
  canvas.height = height;
  context.clearRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  const text = settings.text.trim();
  if (settings.kind === 'text' && !text) {
    return;
  }

  if (settings.kind === 'image' && !watermarkImage) {
    return;
  }

  context.save();
  context.globalAlpha = clamp(settings.opacity, 0.05, 1);

  if (settings.layout === 'proof') {
    if (settings.kind === 'text') {
      drawProofTextWatermark(context, width, height, settings, text);
    } else if (watermarkImage) {
      drawProofImageWatermark(context, width, height, settings, watermarkImage);
    }
  } else if (settings.kind === 'text') {
    drawSingleTextWatermark(context, width, height, settings, text);
  } else if (watermarkImage) {
    drawSingleImageWatermark(context, width, height, settings, watermarkImage);
  }

  context.restore();
}
