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

type RotateFlipConfirmAction = 'clear' | null;

interface TransformState {
  rotation: 0 | 90 | 180 | 270;
  flipX: boolean;
  flipY: boolean;
}

const DEFAULT_TRANSFORM: TransformState = {
  rotation: 0,
  flipX: false,
  flipY: false
};

function getPreviewSize(width: number, height: number): { width: number; height: number } {
  const maxWidth = 960;
  const maxHeight = 720;
  const scale = Math.min(maxWidth / width, maxHeight / height, 1);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  };
}

function inferRotateFormat(asset: ImageAsset): ExportFormat {
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

function createEditedFilename(originalName: string, format: ExportFormat): string {
  const strippedName = originalName.replace(/\.[^.]+$/, '') || 'image';
  return `${strippedName}-edited.${extensionForFormat(format)}`;
}

function getRotatedDimensions(width: number, height: number, rotation: TransformState['rotation']) {
  if (rotation === 90 || rotation === 270) {
    return { width: height, height: width };
  }

  return { width, height };
}

function describeOrientation(transform: TransformState) {
  const parts: string[] = [];

  if (transform.rotation !== 0) {
    parts.push(`Rotated ${transform.rotation}°`);
  }

  if (transform.flipX) {
    parts.push('Flipped horizontally');
  }

  if (transform.flipY) {
    parts.push('Flipped vertically');
  }

  return parts.length > 0 ? parts.join(' • ') : 'Original orientation';
}

function hasEdits(transform: TransformState) {
  return (
    transform.rotation !== DEFAULT_TRANSFORM.rotation ||
    transform.flipX !== DEFAULT_TRANSFORM.flipX ||
    transform.flipY !== DEFAULT_TRANSFORM.flipY
  );
}

function renderTransformedImage(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  transform: TransformState,
  width: number,
  height: number
) {
  const rotatedDimensions = getRotatedDimensions(image.width, image.height, transform.rotation);
  const scale = Math.min(width / rotatedDimensions.width, height / rotatedDimensions.height);
  const drawWidth = Math.round(image.width * scale);
  const drawHeight = Math.round(image.height * scale);

  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('The browser could not prepare the preview.');
  }

  context.clearRect(0, 0, width, height);
  context.save();
  context.translate(width / 2, height / 2);
  context.rotate((transform.rotation * Math.PI) / 180);
  context.scale(transform.flipX ? -1 : 1, transform.flipY ? -1 : 1);
  context.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
  context.restore();
}

export function RotateFlipTool() {
  const [imageAsset, setImageAsset] = useState<ImageAsset | null>(null);
  const [transform, setTransform] = useState<TransformState>(DEFAULT_TRANSFORM);
  const [outputFormat, setOutputFormat] = useState<ExportFormat>('jpeg');
  const [isBusy, setIsBusy] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [confirmAction, setConfirmAction] = useState<RotateFlipConfirmAction>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const exportPreviewCanvasRef = useRef<HTMLCanvasElement>(null);
  const exportCanvasRef = useRef<HTMLCanvasElement>(null);

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

  const outputDimensions = useMemo(() => {
    if (!imageAsset) {
      return null;
    }

    return getRotatedDimensions(imageAsset.width, imageAsset.height, transform.rotation);
  }, [imageAsset, transform.rotation]);

  useEffect(() => {
    if (!imageAsset || !previewCanvasRef.current || !outputDimensions) {
      return;
    }

    const previewSize = getPreviewSize(outputDimensions.width, outputDimensions.height);
    renderTransformedImage(
      previewCanvasRef.current,
      imageAsset.image,
      transform,
      previewSize.width,
      previewSize.height
    );
  }, [imageAsset, outputDimensions, transform]);

  useEffect(() => {
    if (!imageAsset || !exportPreviewCanvasRef.current || !outputDimensions) {
      return;
    }

    const previewSize = getPreviewSize(outputDimensions.width, outputDimensions.height);
    renderTransformedImage(
      exportPreviewCanvasRef.current,
      imageAsset.image,
      transform,
      previewSize.width,
      previewSize.height
    );
  }, [imageAsset, outputDimensions, transform]);

  const imageSummary = useMemo(() => {
    if (!imageAsset) {
      return 'Choose a photo to get started.';
    }

    return `${imageAsset.name} • ${imageAsset.width} × ${imageAsset.height}px`;
  }, [imageAsset]);

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
      setTransform(DEFAULT_TRANSFORM);
      setOutputFormat(inferRotateFormat(nextAsset));
      setStatusMessage('Image ready to rotate or flip.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'The image could not be loaded.');
      setStatusMessage(null);
    } finally {
      setIsBusy(false);
    }
  };

  const rotateLeft = () => {
    setTransform((current) => ({
      ...current,
      rotation: (((current.rotation + 270) % 360) as TransformState['rotation'])
    }));
    setStatusMessage('Preview updated.');
  };

  const rotateRight = () => {
    setTransform((current) => ({
      ...current,
      rotation: (((current.rotation + 90) % 360) as TransformState['rotation'])
    }));
    setStatusMessage('Preview updated.');
  };

  const toggleFlipX = () => {
    setTransform((current) => ({
      ...current,
      flipX: !current.flipX
    }));
    setStatusMessage('Preview updated.');
  };

  const toggleFlipY = () => {
    setTransform((current) => ({
      ...current,
      flipY: !current.flipY
    }));
    setStatusMessage('Preview updated.');
  };

  const resetTransform = () => {
    setTransform(DEFAULT_TRANSFORM);
    setStatusMessage('Orientation reset.');
  };

  const runExport = async (action: 'download' | 'share') => {
    if (!imageAsset || !outputDimensions || !exportCanvasRef.current) {
      setErrorMessage('Choose an image before saving it.');
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);
    setStatusMessage('Saving edited image...');

    try {
      renderTransformedImage(
        exportCanvasRef.current,
        imageAsset.image,
        transform,
        outputDimensions.width,
        outputDimensions.height
      );

      const blob = await exportCanvasToBlob(exportCanvasRef.current, outputFormat, 0.94);
      const filename = createEditedFilename(imageAsset.name, outputFormat);

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
      setErrorMessage(error instanceof Error ? error.message : 'The edited image could not be saved.');
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
    setTransform(DEFAULT_TRANSFORM);
    setStatusMessage('Ready for another image.');
  };

  return (
    <>
      <section className="hero">
        <div className="hero-copy-block">
          <div>
            <p className="eyebrow">Rotate / Flip</p>
            <h1>Rotate or flip images before downloading.</h1>
            <p className="hero-copy">
              Fix image orientation quickly in your browser with simple rotate, flip, and reset controls.
            </p>
            <div className="hero-tags" aria-label="Rotate Flip highlights">
              <span className="hero-tag">Rotate left or right</span>
              <span className="hero-tag">Flip horizontal or vertical</span>
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
              Rotations happen in 90° steps so the final export matches the preview exactly.
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
                  <p className="eyebrow">Preview</p>
                  <h2>Your image</h2>
                </div>
                {outputDimensions ? (
                  <span className="dimension-badge">
                    {outputDimensions.width} × {outputDimensions.height}px
                  </span>
                ) : null}
              </div>
              <div className="preview-shell watermark-preview-shell">
                {imageAsset && outputDimensions ? (
                  <canvas ref={previewCanvasRef} className="preview-canvas" aria-label="Rotated image preview" />
                ) : (
                  <div className="preview-placeholder">
                    <p>Your edited preview will appear here after you choose a photo.</p>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>

        <div className="right-column">
          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Step 2</p>
                <h2>Adjust orientation</h2>
              </div>
            </div>
            <div className="rotate-action-grid">
              <button
                type="button"
                className="rotate-action-button"
                onClick={rotateLeft}
                disabled={!imageAsset || isBusy}
              >
                <span className="rotate-action-label">Rotate Left</span>
                <span className="rotate-action-copy">Turn the image 90° counterclockwise.</span>
              </button>
              <button
                type="button"
                className="rotate-action-button"
                onClick={rotateRight}
                disabled={!imageAsset || isBusy}
              >
                <span className="rotate-action-label">Rotate Right</span>
                <span className="rotate-action-copy">Turn the image 90° clockwise.</span>
              </button>
              <button
                type="button"
                className={`rotate-action-button ${transform.flipX ? 'is-active' : ''}`}
                onClick={toggleFlipX}
                disabled={!imageAsset || isBusy}
              >
                <span className="rotate-action-label">Flip Horizontal</span>
                <span className="rotate-action-copy">Mirror the image left to right.</span>
              </button>
              <button
                type="button"
                className={`rotate-action-button ${transform.flipY ? 'is-active' : ''}`}
                onClick={toggleFlipY}
                disabled={!imageAsset || isBusy}
              >
                <span className="rotate-action-label">Flip Vertical</span>
                <span className="rotate-action-copy">Mirror the image top to bottom.</span>
              </button>
            </div>
            <div className="export-actions export-actions-tight">
              <button
                type="button"
                className="ghost-button"
                onClick={resetTransform}
                disabled={!imageAsset || !hasEdits(transform) || isBusy}
              >
                Reset Changes
              </button>
            </div>
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Step 3</p>
                <h2>Preview result</h2>
              </div>
            </div>
            <div className="controls-grid">
              <div className="field">
                <span>Original</span>
                <p className="helper-text">
                  {imageAsset ? `${imageAsset.width} × ${imageAsset.height}px` : 'Choose a photo first.'}
                </p>
              </div>
              <div className="field">
                <span>Current view</span>
                <p className="helper-text">
                  {outputDimensions
                    ? `${outputDimensions.width} × ${outputDimensions.height}px`
                    : 'Preview updates after you choose a photo.'}
                </p>
              </div>
              <div className="field field-full">
                <span>Orientation</span>
                <p className="helper-text">{describeOrientation(transform)}</p>
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
            {imageAsset && outputDimensions ? (
              <div className="export-preview-block">
                <p className="helper-text export-preview-label">Preview</p>
                <div className="preview-shell export-preview-shell">
                  <canvas
                    ref={exportPreviewCanvasRef}
                    className="preview-canvas"
                    aria-label="Final rotated or flipped image preview"
                  />
                </div>
                <div className="tip-note panel-description panel-description-tight" role="note">
                  <span className="tip-note-icon" aria-hidden="true">
                    i
                  </span>
                  <p className="helper-text">
                    The final image saves exactly as shown here in {formatLabel(outputFormat)} format.
                  </p>
                </div>
              </div>
            ) : null}
            <div className="export-actions">
              <button
                type="button"
                className="primary-button"
                onClick={() => runExport('download')}
                disabled={!imageAsset || !outputDimensions || isBusy}
              >
                Save Image
              </button>
              {canNativeShare ? (
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => runExport('share')}
                  disabled={!imageAsset || !outputDimensions || isBusy}
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
                Start a New Edit
              </button>
            </div>
          </section>
        </div>
      </section>

      <canvas ref={exportCanvasRef} className="sr-only" aria-hidden="true" />
      <ConfirmModal
        open={confirmAction !== null}
        title="Start a new edit?"
        message="This will remove the current image and preview so you can choose a different file."
        confirmLabel="Start New Edit"
        onConfirm={handleChooseAnotherPhoto}
        onCancel={() => setConfirmAction(null)}
      />
    </>
  );
}
