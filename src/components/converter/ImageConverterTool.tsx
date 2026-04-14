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

type ConverterConfirmAction = 'clear' | null;

function getPreviewSize(width: number, height: number): { width: number; height: number } {
  const maxWidth = 960;
  const maxHeight = 720;
  const scale = Math.min(maxWidth / width, maxHeight / height, 1);
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale)
  };
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

function formatLabel(format: ExportFormat): string {
  if (format === 'jpeg') {
    return 'JPEG';
  }

  if (format === 'png') {
    return 'PNG';
  }

  return 'WebP';
}

function inferFormatFromAsset(asset: ImageAsset): ExportFormat {
  if (/\.png$/i.test(asset.name) || asset.mimeType === 'image/png') {
    return 'png';
  }

  if (/\.webp$/i.test(asset.name) || asset.mimeType === 'image/webp') {
    return 'webp';
  }

  return 'jpeg';
}

function inputFormatLabel(asset: ImageAsset | null): string {
  if (!asset) {
    return 'No image selected yet.';
  }

  if (/\.(heic|heif)$/i.test(asset.name)) {
    return 'HEIC / HEIF';
  }

  if (/\.gif$/i.test(asset.name) || asset.mimeType === 'image/gif') {
    return 'GIF';
  }

  if (/\.bmp$/i.test(asset.name) || asset.mimeType === 'image/bmp') {
    return 'BMP';
  }

  if (/\.avif$/i.test(asset.name) || asset.mimeType === 'image/avif') {
    return 'AVIF';
  }

  if (/\.svg$/i.test(asset.name) || asset.mimeType === 'image/svg+xml') {
    return 'SVG';
  }

  if (/\.png$/i.test(asset.name) || asset.mimeType === 'image/png') {
    return 'PNG';
  }

  if (/\.webp$/i.test(asset.name) || asset.mimeType === 'image/webp') {
    return 'WebP';
  }

  return 'JPEG';
}

function createConvertedFilename(originalName: string, format: ExportFormat): string {
  const strippedName = originalName.replace(/\.[^.]+$/, '') || 'image';
  return `${strippedName}-converted.${extensionForFormat(format)}`;
}

function renderConvertedImage(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  width: number,
  height: number,
  format: ExportFormat,
  jpegBackground: string
) {
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('The browser could not prepare the preview.');
  }

  context.clearRect(0, 0, width, height);

  if (format === 'jpeg') {
    context.fillStyle = jpegBackground;
    context.fillRect(0, 0, width, height);
  }

  context.drawImage(image, 0, 0, width, height);
}

function detectTransparency(image: HTMLImageElement): boolean {
  const sampleWidth = Math.min(image.naturalWidth, 256);
  const sampleHeight = Math.min(image.naturalHeight, 256);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, sampleWidth);
  canvas.height = Math.max(1, sampleHeight);
  const context = canvas.getContext('2d', { willReadFrequently: true });

  if (!context) {
    return false;
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);

  for (let index = 3; index < data.length; index += 4) {
    if (data[index] < 255) {
      return true;
    }
  }

  return false;
}

export function ImageConverterTool() {
  const [imageAsset, setImageAsset] = useState<ImageAsset | null>(null);
  const [outputFormat, setOutputFormat] = useState<ExportFormat>('jpeg');
  const [quality, setQuality] = useState(0.92);
  const [jpegBackground, setJpegBackground] = useState('#ffffff');
  const [hasTransparency, setHasTransparency] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConverterConfirmAction>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const exportPreviewCanvasRef = useRef<HTMLCanvasElement>(null);
  const exportCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    setCanNativeShare('share' in navigator && 'canShare' in navigator);
  }, []);

  useEffect(() => {
    if (!imageAsset) {
      setHasTransparency(false);
      return;
    }

    setHasTransparency(detectTransparency(imageAsset.image));
  }, [imageAsset]);

  useEffect(() => {
    if (!imageAsset || !previewCanvasRef.current) {
      return;
    }

    const previewSize = getPreviewSize(imageAsset.width, imageAsset.height);
    renderConvertedImage(
      previewCanvasRef.current,
      imageAsset.image,
      previewSize.width,
      previewSize.height,
      outputFormat,
      jpegBackground
    );
  }, [imageAsset, jpegBackground, outputFormat]);

  useEffect(() => {
    if (!imageAsset || !exportPreviewCanvasRef.current) {
      return;
    }

    const previewSize = getPreviewSize(imageAsset.width, imageAsset.height);
    renderConvertedImage(
      exportPreviewCanvasRef.current,
      imageAsset.image,
      previewSize.width,
      previewSize.height,
      outputFormat,
      jpegBackground
    );
  }, [imageAsset, jpegBackground, outputFormat]);

  useEffect(() => {
    return () => {
      if (imageAsset?.objectUrl) {
        URL.revokeObjectURL(imageAsset.objectUrl);
      }
    };
  }, [imageAsset]);

  const imageSummary = useMemo(() => {
    if (!imageAsset) {
      return 'Choose a photo to get started.';
    }

    return `${imageAsset.name} • ${imageAsset.width} × ${imageAsset.height}px`;
  }, [imageAsset]);

  const sameFormatSelected = useMemo(() => {
    if (!imageAsset) {
      return false;
    }

    return inferFormatFromAsset(imageAsset) === outputFormat;
  }, [imageAsset, outputFormat]);

  const qualityPercent = Math.round(quality * 100);

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
      setOutputFormat(inferFormatFromAsset(nextAsset));
      setQuality(0.92);
      setStatusMessage('Image ready to convert.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'The image could not be loaded.');
      setStatusMessage(null);
    } finally {
      setIsBusy(false);
    }
  };

  const runExport = async (action: 'download' | 'share') => {
    if (!imageAsset || !exportCanvasRef.current) {
      setErrorMessage('Choose an image before saving it.');
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);
    setStatusMessage(`Saving ${formatLabel(outputFormat)}...`);

    try {
      renderConvertedImage(
        exportCanvasRef.current,
        imageAsset.image,
        imageAsset.width,
        imageAsset.height,
        outputFormat,
        jpegBackground
      );

      const blob = await exportCanvasToBlob(exportCanvasRef.current, outputFormat, quality);
      const filename = createConvertedFilename(imageAsset.name, outputFormat);

      if (action === 'share') {
        const shared = await shareImageIfPossible(blob, filename);
        if (!shared) {
          triggerDownload(blob, filename);
          setStatusMessage(`Saved ${filename}.`);
          return;
        }

        setStatusMessage(`Shared ${filename}.`);
        return;
      }

      triggerDownload(blob, filename);
      setStatusMessage(`Saved ${filename}.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'The image could not be converted.');
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
    setHasTransparency(false);
    setQuality(0.92);
    setStatusMessage('Ready for another image.');
  };

  return (
    <>
      <section className="hero">
        <div className="hero-copy-block">
          <div>
            <p className="eyebrow">Image Converter</p>
            <h1>Change image format right in your browser.</h1>
            <p className="hero-copy">
              Convert images between JPG, PNG, and WebP with a simple private workflow that stays
              on your device.
            </p>
            <div className="hero-tags" aria-label="Image converter highlights">
              <span className="hero-tag">JPG PNG WebP</span>
              <span className="hero-tag">HEIC input</span>
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
              Convert JPEG, PNG, WebP, GIF, BMP, AVIF, SVG, HEIC, and HEIF images locally with no uploads.
            </p>
          </div>
        </div>
      </section>

      {errorMessage || statusMessage ? (
        <div className="floating-message-stack">
          {errorMessage ? (
            <FloatingMessage
              tone="error"
              message={errorMessage}
              onDismiss={() => setErrorMessage(null)}
            />
          ) : null}
          {statusMessage ? (
            <FloatingMessage
              tone="status"
              message={statusMessage}
              onDismiss={() => setStatusMessage(null)}
            />
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
                {imageAsset ? (
                  <span className="dimension-badge">
                    {imageAsset.width} × {imageAsset.height}px
                  </span>
                ) : null}
              </div>

              <div className="preview-shell watermark-preview-shell">
                {imageAsset ? (
                  <canvas
                    ref={previewCanvasRef}
                    className="preview-canvas"
                    aria-label="Converted image preview"
                  />
                ) : (
                  <div className="preview-placeholder">
                    <p>Your image preview will appear here after you choose a file.</p>
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
                <h2>Choose format</h2>
              </div>
            </div>

            <div className="preview-compare-bar" aria-label="Output format">
              <span className="preview-compare-label">Format</span>
              <div className="preview-compare-toggle" role="tablist" aria-label="Output format">
                {(['jpeg', 'png', 'webp'] as ExportFormat[]).map((format) => (
                  <button
                    key={format}
                    type="button"
                    role="tab"
                    aria-selected={outputFormat === format}
                    className={`preview-compare-button ${outputFormat === format ? 'is-active' : ''}`}
                    onClick={() => setOutputFormat(format)}
                    disabled={!imageAsset || isBusy}
                  >
                    {formatLabel(format)}
                  </button>
                ))}
              </div>
            </div>

            <div className="tip-note panel-description panel-description-tight" role="note">
              <span className="tip-note-icon" aria-hidden="true">
                i
              </span>
              <p className="helper-text">
                {imageAsset
                  ? `Original format: ${inputFormatLabel(imageAsset)}`
                  : 'Choose a photo first to pick your new format.'}
              </p>
            </div>

            {sameFormatSelected && imageAsset ? (
              <div className="tip-note panel-description panel-description-tight" role="note">
                <span className="tip-note-icon" aria-hidden="true">
                  i
                </span>
                <p className="helper-text">
                  You can still save a fresh copy even when the format stays the same.
                </p>
              </div>
            ) : null}
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Step 3</p>
                <h2>Options</h2>
              </div>
            </div>

            <div className="controls-grid">
              {outputFormat !== 'png' ? (
                <label className="field field-full">
                  <span>Quality</span>
                  <input
                    type="range"
                    min="0.6"
                    max="1"
                    step="0.01"
                    value={quality}
                    onChange={(event) => setQuality(Number(event.target.value))}
                    disabled={!imageAsset || isBusy}
                  />
                  <p className="helper-text">
                    Smaller file <strong>{qualityPercent}%</strong> Better quality
                  </p>
                </label>
              ) : null}

              {outputFormat === 'jpeg' && hasTransparency ? (
                <label className="field field-full">
                  <span>Background color</span>
                  <input
                    type="color"
                    value={jpegBackground}
                    onChange={(event) => setJpegBackground(event.target.value)}
                    disabled={!imageAsset || isBusy}
                  />
                  <p className="helper-text">
                    JPEG does not support transparency, so transparent areas will use this color.
                  </p>
                </label>
              ) : null}

              <div className="field">
                <span>Original</span>
                <p className="helper-text">
                  {imageAsset ? inputFormatLabel(imageAsset) : 'Choose a photo first.'}
                </p>
              </div>
              <div className="field">
                <span>New file</span>
                <p className="helper-text">{formatLabel(outputFormat)}</p>
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

            {imageAsset ? (
              <div className="export-preview-block">
                <p className="helper-text export-preview-label">Preview</p>
                <div className="preview-shell export-preview-shell">
                  <canvas
                    ref={exportPreviewCanvasRef}
                    className="preview-canvas"
                    aria-label="Final converted image preview"
                  />
                </div>
                <div className="tip-note panel-description panel-description-tight" role="note">
                  <span className="tip-note-icon" aria-hidden="true">
                    i
                  </span>
                  <p className="helper-text">
                    Your saved image keeps the original dimensions and uses the new format you picked.
                  </p>
                </div>
              </div>
            ) : null}

            <div className="export-actions">
              <button
                type="button"
                className="primary-button"
                onClick={() => runExport('download')}
                disabled={!imageAsset || isBusy}
              >
                Save {formatLabel(outputFormat)}
              </button>
              {canNativeShare ? (
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => runExport('share')}
                  disabled={!imageAsset || isBusy}
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
                Start a New Conversion
              </button>
            </div>
          </section>
        </div>
      </section>

      <canvas ref={exportCanvasRef} className="sr-only" aria-hidden="true" />
      <ConfirmModal
        open={confirmAction !== null}
        title="Start a new conversion?"
        message="This will remove the current image and preview so you can choose a different file."
        confirmLabel="Start New Conversion"
        onConfirm={handleChooseAnotherPhoto}
        onCancel={() => setConfirmAction(null)}
      />
    </>
  );
}
