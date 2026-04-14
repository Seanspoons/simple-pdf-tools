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
import { clearCompressorHandoff, loadCompressorHandoff } from '../../utils/toolHandoff';
import { ExportFormat, ImageAsset } from '../../types';

type CompressorConfirmAction = 'clear' | null;

function getPreviewSize(width: number, height: number): { width: number; height: number } {
  const maxWidth = 960;
  const maxHeight = 720;
  const scale = Math.min(maxWidth / width, maxHeight / height, 1);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  };
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

function createCompressedFilename(originalName: string, format: ExportFormat): string {
  const strippedName = originalName.replace(/\.[^.]+$/, '') || 'image';
  return `${strippedName}-compressed.${extensionForFormat(format)}`;
}

function formatBytes(bytes: number | null): string {
  if (bytes === null) {
    return 'Not ready yet';
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function renderCompressedImage(
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

function defaultCompressionFormat(asset: ImageAsset): ExportFormat {
  if (/\.png$/i.test(asset.name) || asset.mimeType === 'image/png') {
    return 'png';
  }

  if (/\.webp$/i.test(asset.name) || asset.mimeType === 'image/webp') {
    return 'webp';
  }

  return 'jpeg';
}

export function ImageCompressorTool() {
  const [imageAsset, setImageAsset] = useState<ImageAsset | null>(null);
  const [outputFormat, setOutputFormat] = useState<ExportFormat>('jpeg');
  const [quality, setQuality] = useState(0.82);
  const [jpegBackground, setJpegBackground] = useState('#ffffff');
  const [hasTransparency, setHasTransparency] = useState(false);
  const [estimatedSize, setEstimatedSize] = useState<number | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [confirmAction, setConfirmAction] = useState<CompressorConfirmAction>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const exportPreviewCanvasRef = useRef<HTMLCanvasElement>(null);
  const exportCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    setCanNativeShare('share' in navigator && 'canShare' in navigator);
  }, []);

  useEffect(() => {
    let isCancelled = false;

    async function hydrateHandoff() {
      try {
        const handoffFile = await loadCompressorHandoff();
        if (!handoffFile) {
          return;
        }

        await clearCompressorHandoff();
        const nextAsset = await loadImageAsset(handoffFile);
        if (isCancelled) {
          if (nextAsset.objectUrl) {
            URL.revokeObjectURL(nextAsset.objectUrl);
          }
          return;
        }

        setImageAsset((current) => {
          if (current?.objectUrl) {
            URL.revokeObjectURL(current.objectUrl);
          }
          return nextAsset;
        });
        setOutputFormat(defaultCompressionFormat(nextAsset));
        setQuality(0.82);
        setErrorMessage(null);
        setStatusMessage('Loaded your resized image and it is ready to compress.');
      } catch (error) {
        if (!isCancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : 'The resized image could not be loaded into compression.'
          );
        }
      }
    }

    void hydrateHandoff();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (imageAsset?.objectUrl) {
        URL.revokeObjectURL(imageAsset.objectUrl);
      }
    };
  }, [imageAsset]);

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
    renderCompressedImage(
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
    renderCompressedImage(
      exportPreviewCanvasRef.current,
      imageAsset.image,
      previewSize.width,
      previewSize.height,
      outputFormat,
      jpegBackground
    );
  }, [imageAsset, jpegBackground, outputFormat]);

  useEffect(() => {
    let isCancelled = false;

    async function estimate() {
      if (!imageAsset || !exportCanvasRef.current) {
        setEstimatedSize(null);
        return;
      }

      try {
        renderCompressedImage(
          exportCanvasRef.current,
          imageAsset.image,
          imageAsset.width,
          imageAsset.height,
          outputFormat,
          jpegBackground
        );
        const blob = await exportCanvasToBlob(exportCanvasRef.current, outputFormat, quality);
        if (!isCancelled) {
          setEstimatedSize(blob.size);
        }
      } catch {
        if (!isCancelled) {
          setEstimatedSize(null);
        }
      }
    }

    void estimate();

    return () => {
      isCancelled = true;
    };
  }, [imageAsset, jpegBackground, outputFormat, quality]);

  const imageSummary = useMemo(() => {
    if (!imageAsset) {
      return 'Choose a photo to get started.';
    }

    return `${imageAsset.name} • ${formatBytes(imageAsset.file.size)}`;
  }, [imageAsset]);

  const qualityPercent = Math.round(quality * 100);
  const usesLossyCompression = outputFormat === 'jpeg' || outputFormat === 'webp';

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
      setOutputFormat(defaultCompressionFormat(nextAsset));
      setQuality(0.82);
      setStatusMessage('Image ready to compress.');
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
    setStatusMessage('Saving compressed image...');

    try {
      renderCompressedImage(
        exportCanvasRef.current,
        imageAsset.image,
        imageAsset.width,
        imageAsset.height,
        outputFormat,
        jpegBackground
      );
      const blob = await exportCanvasToBlob(exportCanvasRef.current, outputFormat, quality);
      const filename = createCompressedFilename(imageAsset.name, outputFormat);

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
      setErrorMessage(error instanceof Error ? error.message : 'The image could not be compressed.');
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
    setEstimatedSize(null);
    setStatusMessage('Ready for another image.');
  };

  return (
    <>
      <section className="hero">
        <div className="hero-copy-block">
          <div>
            <p className="eyebrow">Image Compressor</p>
            <h1>Make image files smaller for uploads and sharing.</h1>
            <p className="hero-copy">
              Lower image file size right in your browser with simple quality controls and no uploads.
            </p>
            <div className="hero-tags" aria-label="Image compressor highlights">
              <span className="hero-tag">JPEG, PNG, or WebP</span>
              <span className="hero-tag">Quality slider</span>
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
              This tool is built for smaller file sizes, not changing dimensions.
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
                {imageAsset ? (
                  <span className="dimension-badge">
                    {imageAsset.width} × {imageAsset.height}px
                  </span>
                ) : null}
              </div>
              <div className="preview-shell watermark-preview-shell">
                {imageAsset ? (
                  <canvas ref={previewCanvasRef} className="preview-canvas" aria-label="Compressed image preview" />
                ) : (
                  <div className="preview-placeholder">
                    <p>Your compressed preview will appear here after you choose a photo.</p>
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
                <h2>Choose settings</h2>
              </div>
            </div>
            <div className="preview-compare-bar" aria-label="Compression output format">
              <span className="preview-compare-label">Format</span>
              <div className="preview-compare-toggle" role="tablist" aria-label="Compression output format">
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
            <div className="controls-grid">
              {usesLossyCompression ? (
                <label className="field field-full">
                  <span>Quality</span>
                  <input
                    type="range"
                    min="0.5"
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
              ) : (
                <div className="field field-full">
                  <span>Quality</span>
                  <p className="helper-text">
                    PNG keeps full image quality and transparency. File size may not shrink as much.
                  </p>
                </div>
              )}
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
            </div>
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Step 3</p>
                <h2>Review result</h2>
              </div>
            </div>
            <div className="controls-grid">
              <div className="field">
                <span>Original size</span>
                <p className="helper-text">
                  {imageAsset ? formatBytes(imageAsset.file.size) : 'Choose a photo first.'}
                </p>
              </div>
              <div className="field">
                <span>Estimated size</span>
                <p className="helper-text">{formatBytes(estimatedSize)}</p>
              </div>
              <div className="field">
                <span>Save format</span>
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
                    aria-label="Final compressed image preview"
                  />
                </div>
                <div className="tip-note panel-description panel-description-tight" role="note">
                  <span className="tip-note-icon" aria-hidden="true">
                    i
                  </span>
                  <p className="helper-text">
                    Compression changes file size, not the pixel dimensions of your image.
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
                Save Compressed Image
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
                Start a New Compression
              </button>
            </div>
          </section>
        </div>
      </section>

      <canvas ref={exportCanvasRef} className="sr-only" aria-hidden="true" />
      <ConfirmModal
        open={confirmAction !== null}
        title="Start a new compression?"
        message="This will remove the current image and preview so you can choose a different file."
        confirmLabel="Start New Compression"
        onConfirm={handleChooseAnotherPhoto}
        onCancel={() => setConfirmAction(null)}
      />
    </>
  );
}
