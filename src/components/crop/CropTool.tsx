import { useEffect, useMemo, useRef, useState } from 'react';
import { ConfirmModal } from '../ConfirmModal';
import { FloatingMessage } from '../FloatingMessage';
import { UploadPanel } from '../UploadPanel';
import {
  exportCanvasToBlob,
  shareImageIfPossible,
  triggerDownload
} from '../../utils/exportImage';
import { loadImageAsset } from '../../utils/imageLoader';
import { ExportFormat, ImageAsset } from '../../types';

type CropConfirmAction = 'clear' | null;
type CropPreset = 'free' | '1:1' | '4:5' | '16:9' | '3:2';
type CropHandle = 'move' | 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se';

interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CropInteraction {
  mode: CropHandle;
  startX: number;
  startY: number;
  startRect: CropRect;
}

const MIN_CROP_SIZE = 40;

function getPreviewSize(width: number, height: number): { width: number; height: number } {
  const maxWidth = 960;
  const maxHeight = 720;
  const scale = Math.min(maxWidth / width, maxHeight / height, 1);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  };
}

function inferCropFormat(asset: ImageAsset): ExportFormat {
  if (/\.png$/i.test(asset.name) || asset.mimeType === 'image/png') {
    return 'png';
  }

  if (/\.webp$/i.test(asset.name) || asset.mimeType === 'image/webp') {
    return 'webp';
  }

  return 'jpeg';
}

function formatLabel(format: ExportFormat): string {
  if (format === 'png') {
    return 'PNG';
  }

  if (format === 'webp') {
    return 'WebP';
  }

  return 'JPEG';
}

function extensionForFormat(format: ExportFormat): string {
  if (format === 'png') {
    return 'png';
  }

  if (format === 'webp') {
    return 'webp';
  }

  return 'jpg';
}

function createCroppedFilename(originalName: string, format: ExportFormat): string {
  const strippedName = originalName.replace(/\.[^.]+$/, '') || 'image';
  return `${strippedName}-cropped.${extensionForFormat(format)}`;
}

function getAspectRatio(preset: CropPreset): number | null {
  if (preset === '1:1') {
    return 1;
  }

  if (preset === '4:5') {
    return 4 / 5;
  }

  if (preset === '16:9') {
    return 16 / 9;
  }

  if (preset === '3:2') {
    return 3 / 2;
  }

  return null;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function createDefaultCrop(width: number, height: number, preset: CropPreset): CropRect {
  const ratio = getAspectRatio(preset);
  const maxWidth = width * 0.88;
  const maxHeight = height * 0.88;

  if (!ratio) {
    const cropWidth = Math.max(MIN_CROP_SIZE, Math.round(maxWidth));
    const cropHeight = Math.max(MIN_CROP_SIZE, Math.round(maxHeight));
    return {
      x: Math.round((width - cropWidth) / 2),
      y: Math.round((height - cropHeight) / 2),
      width: cropWidth,
      height: cropHeight
    };
  }

  let cropWidth = maxWidth;
  let cropHeight = cropWidth / ratio;
  if (cropHeight > maxHeight) {
    cropHeight = maxHeight;
    cropWidth = cropHeight * ratio;
  }

  cropWidth = Math.max(MIN_CROP_SIZE, Math.round(cropWidth));
  cropHeight = Math.max(MIN_CROP_SIZE, Math.round(cropHeight));

  return {
    x: Math.round((width - cropWidth) / 2),
    y: Math.round((height - cropHeight) / 2),
    width: cropWidth,
    height: cropHeight
  };
}

function fitCropToAspect(crop: CropRect, imageWidth: number, imageHeight: number, preset: CropPreset): CropRect {
  const ratio = getAspectRatio(preset);
  if (!ratio) {
    return crop;
  }

  const centerX = crop.x + crop.width / 2;
  const centerY = crop.y + crop.height / 2;
  const targetArea = crop.width * crop.height;

  let nextWidth = Math.sqrt(targetArea * ratio);
  let nextHeight = nextWidth / ratio;

  if (nextWidth > imageWidth) {
    nextWidth = imageWidth;
    nextHeight = nextWidth / ratio;
  }

  if (nextHeight > imageHeight) {
    nextHeight = imageHeight;
    nextWidth = nextHeight * ratio;
  }

  if (nextWidth < MIN_CROP_SIZE) {
    nextWidth = MIN_CROP_SIZE;
    nextHeight = nextWidth / ratio;
  }

  if (nextHeight < MIN_CROP_SIZE) {
    nextHeight = MIN_CROP_SIZE;
    nextWidth = nextHeight * ratio;
  }

  nextWidth = Math.min(nextWidth, imageWidth);
  nextHeight = Math.min(nextHeight, imageHeight);

  const x = clamp(centerX - nextWidth / 2, 0, imageWidth - nextWidth);
  const y = clamp(centerY - nextHeight / 2, 0, imageHeight - nextHeight);

  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(nextWidth),
    height: Math.round(nextHeight)
  };
}

function renderImage(canvas: HTMLCanvasElement, image: HTMLImageElement, width: number, height: number) {
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('The browser could not prepare the preview.');
  }

  context.clearRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
}

function renderCroppedPreview(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  crop: CropRect,
  width: number,
  height: number
) {
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('The browser could not prepare the crop preview.');
  }

  context.clearRect(0, 0, width, height);
  context.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    width,
    height
  );
}

function adjustCropForInteraction(
  interaction: CropInteraction,
  pointX: number,
  pointY: number,
  imageWidth: number,
  imageHeight: number,
  preset: CropPreset
): CropRect {
  const ratio = getAspectRatio(preset);
  const startRect = interaction.startRect;
  const startRight = startRect.x + startRect.width;
  const startBottom = startRect.y + startRect.height;
  const deltaX = pointX - interaction.startX;
  const deltaY = pointY - interaction.startY;

  if (interaction.mode === 'move') {
    return {
      x: Math.round(clamp(startRect.x + deltaX, 0, imageWidth - startRect.width)),
      y: Math.round(clamp(startRect.y + deltaY, 0, imageHeight - startRect.height)),
      width: startRect.width,
      height: startRect.height
    };
  }

  if (!ratio) {
    if (interaction.mode === 'n') {
      const y = clamp(startRect.y + deltaY, 0, startBottom - MIN_CROP_SIZE);
      return {
        x: startRect.x,
        y: Math.round(y),
        width: startRect.width,
        height: Math.round(startBottom - y)
      };
    }

    if (interaction.mode === 's') {
      const bottom = clamp(startBottom + deltaY, startRect.y + MIN_CROP_SIZE, imageHeight);
      return {
        x: startRect.x,
        y: startRect.y,
        width: startRect.width,
        height: Math.round(bottom - startRect.y)
      };
    }

    if (interaction.mode === 'w') {
      const x = clamp(startRect.x + deltaX, 0, startRight - MIN_CROP_SIZE);
      return {
        x: Math.round(x),
        y: startRect.y,
        width: Math.round(startRight - x),
        height: startRect.height
      };
    }

    if (interaction.mode === 'e') {
      const right = clamp(startRight + deltaX, startRect.x + MIN_CROP_SIZE, imageWidth);
      return {
        x: startRect.x,
        y: startRect.y,
        width: Math.round(right - startRect.x),
        height: startRect.height
      };
    }

    if (interaction.mode === 'nw') {
      const x = clamp(startRect.x + deltaX, 0, startRight - MIN_CROP_SIZE);
      const y = clamp(startRect.y + deltaY, 0, startBottom - MIN_CROP_SIZE);
      return {
        x: Math.round(x),
        y: Math.round(y),
        width: Math.round(startRight - x),
        height: Math.round(startBottom - y)
      };
    }

    if (interaction.mode === 'ne') {
      const right = clamp(startRight + deltaX, startRect.x + MIN_CROP_SIZE, imageWidth);
      const y = clamp(startRect.y + deltaY, 0, startBottom - MIN_CROP_SIZE);
      return {
        x: startRect.x,
        y: Math.round(y),
        width: Math.round(right - startRect.x),
        height: Math.round(startBottom - y)
      };
    }

    if (interaction.mode === 'sw') {
      const x = clamp(startRect.x + deltaX, 0, startRight - MIN_CROP_SIZE);
      const bottom = clamp(startBottom + deltaY, startRect.y + MIN_CROP_SIZE, imageHeight);
      return {
        x: Math.round(x),
        y: startRect.y,
        width: Math.round(startRight - x),
        height: Math.round(bottom - startRect.y)
      };
    }

    const right = clamp(startRight + deltaX, startRect.x + MIN_CROP_SIZE, imageWidth);
    const bottom = clamp(startBottom + deltaY, startRect.y + MIN_CROP_SIZE, imageHeight);
    return {
      x: startRect.x,
      y: startRect.y,
      width: Math.round(right - startRect.x),
      height: Math.round(bottom - startRect.y)
    };
  }

  const withAspect = (anchorX: number, anchorY: number, proposedWidth: number, directionX: -1 | 1, directionY: -1 | 1): CropRect => {
    let width = Math.max(MIN_CROP_SIZE, proposedWidth);
    let height = width / ratio;

    const maxWidth = directionX === 1 ? imageWidth - anchorX : anchorX;
    const maxHeight = directionY === 1 ? imageHeight - anchorY : anchorY;

    if (width > maxWidth) {
      width = maxWidth;
      height = width / ratio;
    }

    if (height > maxHeight) {
      height = maxHeight;
      width = height * ratio;
    }

    width = Math.max(MIN_CROP_SIZE, width);
    height = Math.max(MIN_CROP_SIZE, height);

    const x = directionX === 1 ? anchorX : anchorX - width;
    const y = directionY === 1 ? anchorY : anchorY - height;

    return {
      x: Math.round(clamp(x, 0, imageWidth - width)),
      y: Math.round(clamp(y, 0, imageHeight - height)),
      width: Math.round(width),
      height: Math.round(height)
    };
  };

  const withAspectCentered = (
    proposedPrimarySize: number,
    primaryAxis: 'x' | 'y',
    anchorEdge: 'start' | 'end'
  ): CropRect => {
    let width = primaryAxis === 'x' ? proposedPrimarySize : proposedPrimarySize * ratio;
    let height = width / ratio;

    if (primaryAxis === 'y') {
      height = proposedPrimarySize;
      width = height * ratio;
    }

    width = Math.max(MIN_CROP_SIZE, width);
    height = Math.max(MIN_CROP_SIZE, height);

    let x =
      primaryAxis === 'x'
        ? anchorEdge === 'start'
          ? startRect.x
          : startRight - width
        : startRect.x + startRect.width / 2 - width / 2;
    let y =
      primaryAxis === 'y'
        ? anchorEdge === 'start'
          ? startRect.y
          : startBottom - height
        : startRect.y + startRect.height / 2 - height / 2;

    x = clamp(x, 0, imageWidth - width);
    y = clamp(y, 0, imageHeight - height);

    if (x < 0) {
      x = 0;
    }
    if (y < 0) {
      y = 0;
    }
    if (x + width > imageWidth) {
      x = imageWidth - width;
    }
    if (y + height > imageHeight) {
      y = imageHeight - height;
    }

    if (primaryAxis === 'x') {
      if (anchorEdge === 'start') {
        width = Math.min(width, imageWidth - startRect.x);
        height = width / ratio;
        y = clamp(startRect.y + startRect.height / 2 - height / 2, 0, imageHeight - height);
      } else {
        width = Math.min(width, startRight);
        height = width / ratio;
        x = startRight - width;
        y = clamp(startRect.y + startRect.height / 2 - height / 2, 0, imageHeight - height);
      }
    } else if (anchorEdge === 'start') {
      height = Math.min(height, imageHeight - startRect.y);
      width = height * ratio;
      x = clamp(startRect.x + startRect.width / 2 - width / 2, 0, imageWidth - width);
    } else {
      height = Math.min(height, startBottom);
      width = height * ratio;
      y = startBottom - height;
      x = clamp(startRect.x + startRect.width / 2 - width / 2, 0, imageWidth - width);
    }

    return {
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(width),
      height: Math.round(height)
    };
  };

  if (interaction.mode === 'n') {
    const height = startBottom - clamp(startRect.y + deltaY, 0, startBottom - MIN_CROP_SIZE);
    return withAspectCentered(height, 'y', 'end');
  }

  if (interaction.mode === 's') {
    const height = clamp(startBottom + deltaY, startRect.y + MIN_CROP_SIZE, imageHeight) - startRect.y;
    return withAspectCentered(height, 'y', 'start');
  }

  if (interaction.mode === 'w') {
    const width = startRight - clamp(startRect.x + deltaX, 0, startRight - MIN_CROP_SIZE);
    return withAspectCentered(width, 'x', 'end');
  }

  if (interaction.mode === 'e') {
    const width = clamp(startRight + deltaX, startRect.x + MIN_CROP_SIZE, imageWidth) - startRect.x;
    return withAspectCentered(width, 'x', 'start');
  }

  if (interaction.mode === 'nw') {
    const widthFromX = startRight - clamp(startRect.x + deltaX, 0, startRight - MIN_CROP_SIZE);
    const widthFromY = (startBottom - clamp(startRect.y + deltaY, 0, startBottom - MIN_CROP_SIZE)) * ratio;
    return withAspect(startRight, startBottom, Math.max(widthFromX, widthFromY), -1, -1);
  }

  if (interaction.mode === 'ne') {
    const widthFromX = clamp(startRight + deltaX, startRect.x + MIN_CROP_SIZE, imageWidth) - startRect.x;
    const widthFromY = (startBottom - clamp(startRect.y + deltaY, 0, startBottom - MIN_CROP_SIZE)) * ratio;
    return withAspect(startRect.x, startBottom, Math.max(widthFromX, widthFromY), 1, -1);
  }

  if (interaction.mode === 'sw') {
    const widthFromX = startRight - clamp(startRect.x + deltaX, 0, startRight - MIN_CROP_SIZE);
    const widthFromY = clamp(startBottom + deltaY, startRect.y + MIN_CROP_SIZE, imageHeight) * ratio - startRect.y * ratio;
    return withAspect(startRight, startRect.y, Math.max(widthFromX, widthFromY), -1, 1);
  }

  const widthFromX = clamp(startRight + deltaX, startRect.x + MIN_CROP_SIZE, imageWidth) - startRect.x;
  const widthFromY = (clamp(startBottom + deltaY, startRect.y + MIN_CROP_SIZE, imageHeight) - startRect.y) * ratio;
  return withAspect(startRect.x, startRect.y, Math.max(widthFromX, widthFromY), 1, 1);
}

export function CropTool() {
  const [imageAsset, setImageAsset] = useState<ImageAsset | null>(null);
  const [cropRect, setCropRect] = useState<CropRect | null>(null);
  const [aspectPreset, setAspectPreset] = useState<CropPreset>('free');
  const [outputFormat, setOutputFormat] = useState<ExportFormat>('jpeg');
  const [interaction, setInteraction] = useState<CropInteraction | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [confirmAction, setConfirmAction] = useState<CropConfirmAction>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const exportPreviewCanvasRef = useRef<HTMLCanvasElement>(null);
  const exportCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCanNativeShare('share' in navigator && 'canShare' in navigator);
  }, []);

  useEffect(() => {
    return () => {
      if (imageAsset?.objectUrl) {
        URL.revokeObjectURL(imageAsset.objectUrl);
      }
    };
  }, [imageAsset]);

  const previewSize = useMemo(() => {
    if (!imageAsset) {
      return null;
    }

    return getPreviewSize(imageAsset.width, imageAsset.height);
  }, [imageAsset]);

  useEffect(() => {
    if (!imageAsset || !previewCanvasRef.current || !previewSize) {
      return;
    }

    renderImage(previewCanvasRef.current, imageAsset.image, previewSize.width, previewSize.height);
  }, [imageAsset, previewSize]);

  useEffect(() => {
    if (!imageAsset || !exportPreviewCanvasRef.current || !cropRect) {
      return;
    }

    const exportPreviewSize = getPreviewSize(cropRect.width, cropRect.height);
    renderCroppedPreview(
      exportPreviewCanvasRef.current,
      imageAsset.image,
      cropRect,
      exportPreviewSize.width,
      exportPreviewSize.height
    );
  }, [cropRect, imageAsset]);

  const imageSummary = useMemo(() => {
    if (!imageAsset) {
      return 'Choose a photo to get started.';
    }

    return `${imageAsset.name} • ${imageAsset.width} × ${imageAsset.height}px`;
  }, [imageAsset]);

  const cropSummary = useMemo(() => {
    if (!cropRect) {
      return 'Choose a photo to start cropping.';
    }

    return `${cropRect.width} × ${cropRect.height}px`;
  }, [cropRect]);

  const cropDisplayStyle = useMemo(() => {
    if (!cropRect || !imageAsset) {
      return null;
    }

    return {
      left: `${(cropRect.x / imageAsset.width) * 100}%`,
      top: `${(cropRect.y / imageAsset.height) * 100}%`,
      width: `${(cropRect.width / imageAsset.width) * 100}%`,
      height: `${(cropRect.height / imageAsset.height) * 100}%`
    };
  }, [cropRect, imageAsset]);

  const handleFileSelect = async (file: File) => {
    setIsBusy(true);
    setErrorMessage(null);
    setStatusMessage('Opening image...');

    try {
      const nextAsset = await loadImageAsset(file);
      setImageAsset((current) => {
        if (current?.objectUrl) {
          URL.revokeObjectURL(current.objectUrl);
        }
        return nextAsset;
      });
      setAspectPreset('free');
      setCropRect(createDefaultCrop(nextAsset.width, nextAsset.height, 'free'));
      setOutputFormat(inferCropFormat(nextAsset));
      setStatusMessage('Image ready to crop.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'The image could not be loaded.');
      setStatusMessage(null);
    } finally {
      setIsBusy(false);
    }
  };

  const beginInteraction = (
    event: React.PointerEvent<HTMLElement>,
    mode: CropHandle
  ) => {
    if (!imageAsset || !cropRect || !overlayRef.current) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const bounds = overlayRef.current.getBoundingClientRect();
    const pointX = ((event.clientX - bounds.left) / bounds.width) * imageAsset.width;
    const pointY = ((event.clientY - bounds.top) / bounds.height) * imageAsset.height;

    setInteraction({
      mode,
      startX: pointX,
      startY: pointY,
      startRect: cropRect
    });
  };

  useEffect(() => {
    if (!interaction || !imageAsset || !overlayRef.current) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (!overlayRef.current) {
        return;
      }

      event.preventDefault();
      const bounds = overlayRef.current.getBoundingClientRect();
      const pointX = ((event.clientX - bounds.left) / bounds.width) * imageAsset.width;
      const pointY = ((event.clientY - bounds.top) / bounds.height) * imageAsset.height;

      const nextRect = adjustCropForInteraction(
        interaction,
        pointX,
        pointY,
        imageAsset.width,
        imageAsset.height,
        aspectPreset
      );
      setCropRect(nextRect);
    };

    const handlePointerUp = () => {
      setInteraction(null);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [aspectPreset, imageAsset, interaction]);

  const handlePresetChange = (preset: CropPreset) => {
    setAspectPreset(preset);
    if (!imageAsset || !cropRect) {
      return;
    }

    setCropRect((current) => {
      if (!current) {
        return createDefaultCrop(imageAsset.width, imageAsset.height, preset);
      }

      return preset === 'free'
        ? current
        : fitCropToAspect(current, imageAsset.width, imageAsset.height, preset);
    });
  };

  const handleResetCrop = () => {
    if (!imageAsset) {
      return;
    }

    setCropRect(createDefaultCrop(imageAsset.width, imageAsset.height, aspectPreset));
    setStatusMessage('Crop area reset.');
  };

  const runExport = async (action: 'download' | 'share') => {
    if (!imageAsset || !exportCanvasRef.current || !cropRect) {
      setErrorMessage('Choose an image and set a crop area before saving it.');
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);
    setStatusMessage('Saving cropped image...');

    try {
      renderCroppedPreview(
        exportCanvasRef.current,
        imageAsset.image,
        cropRect,
        cropRect.width,
        cropRect.height
      );

      const blob = await exportCanvasToBlob(exportCanvasRef.current, outputFormat, 0.94);
      const filename = createCroppedFilename(imageAsset.name, outputFormat);

      if (action === 'share') {
        const shared = await shareImageIfPossible(blob, filename);
        if (!shared) {
          triggerDownload(blob, filename);
          setStatusMessage(`${filename} is ready.`);
          return;
        }

        setStatusMessage(`${filename} is ready.`);
        return;
      }

      triggerDownload(blob, filename);
      setStatusMessage(`${filename} is ready.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'The image could not be cropped.');
      setStatusMessage(null);
    } finally {
      setIsBusy(false);
    }
  };

  const handleChooseAnotherPhoto = () => {
    setConfirmAction(null);
    setImageAsset((current) => {
      if (current?.objectUrl) {
        URL.revokeObjectURL(current.objectUrl);
      }
      return null;
    });
    setCropRect(null);
    setAspectPreset('free');
    setStatusMessage('Ready for another image.');
  };

  return (
    <>
      <section className="hero">
        <div className="hero-copy-block">
          <div>
            <p className="eyebrow">Crop Tool</p>
            <h1>Crop images to the area you want to keep.</h1>
            <p className="hero-copy">
              Drag the crop box, resize it with the corner handles, and save the cropped result right in your browser.
            </p>
            <div className="hero-tags" aria-label="Crop tool highlights">
              <span className="hero-tag">Free crop</span>
              <span className="hero-tag">Aspect ratio presets</span>
              <span className="hero-tag">Private in browser</span>
            </div>
          </div>
        </div>
        <div className="hero-card">
          <p className="hero-stat-label">Your image</p>
          <p className="hero-stat">{imageSummary}</p>
          <div className="tip-note" role="note">
            <span className="tip-note-icon" aria-hidden="true">
              i
            </span>
            <p className="helper-text">
              Choose a preset ratio or crop freely, then save only the part you want to keep.
            </p>
          </div>
        </div>
      </section>

      {errorMessage || statusMessage ? (
        <div className="floating-message-stack">
          {errorMessage ? (
            <FloatingMessage tone="error" message={errorMessage} onDismiss={() => setErrorMessage(null)} />
          ) : null}
          {statusMessage ? (
            <FloatingMessage tone="status" message={statusMessage} onDismiss={() => setStatusMessage(null)} />
          ) : null}
        </div>
      ) : null}

      <section className="layout-grid converter-layout-grid">
        <div className="left-column">
          <UploadPanel onFileSelect={handleFileSelect} disabled={isBusy} fileName={imageAsset?.name} />
          <div className="preview-sticky-wrap">
            <section className="panel preview-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Step 2</p>
                  <h2>Choose crop area</h2>
                </div>
                {cropRect ? <span className="dimension-badge">{cropSummary}</span> : null}
              </div>
              <div className="preview-shell watermark-preview-shell crop-preview-shell">
                {imageAsset && previewSize && cropDisplayStyle ? (
                  <div
                    ref={overlayRef}
                    className="crop-preview-stage"
                    style={{
                      width: '100%',
                      maxWidth: `${previewSize.width}px`,
                      aspectRatio: `${previewSize.width} / ${previewSize.height}`
                    }}
                  >
                    <canvas ref={previewCanvasRef} className="preview-canvas" aria-label="Crop selection preview" />
                    <div
                      className={`crop-selection ${interaction ? 'is-active' : ''}`}
                      style={cropDisplayStyle}
                      onPointerDown={(event) => beginInteraction(event, 'move')}
                    >
                      <div className="crop-selection-grid">
                        <span />
                        <span />
                      </div>
                      <button
                        type="button"
                        className="crop-handle crop-handle-n"
                        onPointerDown={(event) => beginInteraction(event, 'n')}
                        aria-label="Resize crop from top edge"
                      />
                      <button
                        type="button"
                        className="crop-handle crop-handle-s"
                        onPointerDown={(event) => beginInteraction(event, 's')}
                        aria-label="Resize crop from bottom edge"
                      />
                      <button
                        type="button"
                        className="crop-handle crop-handle-w"
                        onPointerDown={(event) => beginInteraction(event, 'w')}
                        aria-label="Resize crop from left edge"
                      />
                      <button
                        type="button"
                        className="crop-handle crop-handle-e"
                        onPointerDown={(event) => beginInteraction(event, 'e')}
                        aria-label="Resize crop from right edge"
                      />
                      <button
                        type="button"
                        className="crop-handle crop-handle-nw"
                        onPointerDown={(event) => beginInteraction(event, 'nw')}
                        aria-label="Resize crop from top left"
                      />
                      <button
                        type="button"
                        className="crop-handle crop-handle-ne"
                        onPointerDown={(event) => beginInteraction(event, 'ne')}
                        aria-label="Resize crop from top right"
                      />
                      <button
                        type="button"
                        className="crop-handle crop-handle-sw"
                        onPointerDown={(event) => beginInteraction(event, 'sw')}
                        aria-label="Resize crop from bottom left"
                      />
                      <button
                        type="button"
                        className="crop-handle crop-handle-se"
                        onPointerDown={(event) => beginInteraction(event, 'se')}
                        aria-label="Resize crop from bottom right"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="preview-placeholder">
                    <p>Your crop workspace will appear here after you choose a photo.</p>
                  </div>
                )}
              </div>
              <div className="preview-footer">
                <div className="tip-note" role="note">
                  <span className="tip-note-icon" aria-hidden="true">
                    i
                  </span>
                  <p className="helper-text">
                    Drag inside the crop box to move it, or drag a corner handle to resize it.
                  </p>
                </div>
              </div>
            </section>
          </div>
        </div>

        <div className="right-column">
          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Step 3</p>
                <h2>Select aspect ratio</h2>
              </div>
            </div>
            <div className="preview-compare-bar" aria-label="Crop aspect ratio presets">
              <span className="preview-compare-label">Preset</span>
              <div className="preview-compare-toggle" role="tablist" aria-label="Crop aspect ratio presets">
                {(['free', '1:1', '4:5', '16:9', '3:2'] as CropPreset[]).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    role="tab"
                    aria-selected={aspectPreset === preset}
                    className={`preview-compare-button ${aspectPreset === preset ? 'is-active' : ''}`}
                    onClick={() => handlePresetChange(preset)}
                    disabled={!imageAsset || isBusy}
                  >
                    {preset === 'free' ? 'Free' : preset}
                  </button>
                ))}
              </div>
            </div>
            <div className="controls-grid">
              <div className="field">
                <span>Current crop</span>
                <p className="helper-text">{cropSummary}</p>
              </div>
              <div className="field">
                <span>Save format</span>
                <p className="helper-text">{formatLabel(outputFormat)}</p>
              </div>
              <div className="field field-full">
                <button
                  type="button"
                  className="ghost-button"
                  onClick={handleResetCrop}
                  disabled={!imageAsset || !cropRect || isBusy}
                >
                  Reset crop
                </button>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Step 4</p>
                <h2>Export</h2>
              </div>
            </div>
            {imageAsset && cropRect ? (
              <div className="export-preview-block">
                <p className="helper-text export-preview-label">Preview</p>
                <div className="preview-shell export-preview-shell">
                  <canvas
                    ref={exportPreviewCanvasRef}
                    className="preview-canvas"
                    aria-label="Final cropped image preview"
                  />
                </div>
                <div className="tip-note panel-description panel-description-tight" role="note">
                  <span className="tip-note-icon" aria-hidden="true">
                    i
                  </span>
                  <p className="helper-text">
                    Cropped images save only the selected area and keep the original format when possible.
                  </p>
                </div>
              </div>
            ) : null}
            <div className="export-actions">
              <button
                type="button"
                className="primary-button"
                onClick={() => runExport('download')}
                disabled={!imageAsset || !cropRect || isBusy}
              >
                Save Cropped Image
              </button>
              {canNativeShare ? (
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => runExport('share')}
                  disabled={!imageAsset || !cropRect || isBusy}
                >
                  Share / Save to Photos
                </button>
              ) : null}
              <button
                type="button"
                className="ghost-button"
                onClick={() => setConfirmAction('clear')}
                disabled={!imageAsset || isBusy}
              >
                Start a New Crop
              </button>
            </div>
          </section>
        </div>
      </section>

      <canvas ref={exportCanvasRef} className="sr-only" aria-hidden="true" />
      <ConfirmModal
        open={confirmAction !== null}
        title="Start a new crop?"
        message="This will remove the current image and crop selection so you can choose a different file."
        confirmLabel="Start New Crop"
        onConfirm={handleChooseAnotherPhoto}
        onCancel={() => setConfirmAction(null)}
      />
    </>
  );
}
