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
import { saveCompressorHandoff } from '../../utils/toolHandoff';
import { ExportFormat, ImageAsset } from '../../types';

type ResizerConfirmAction = 'clear' | null;

function getPreviewSize(width: number, height: number): { width: number; height: number } {
  const maxWidth = 960;
  const maxHeight = 720;
  const scale = Math.min(maxWidth / width, maxHeight / height, 1);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  };
}

function inferResizeFormat(asset: ImageAsset): ExportFormat {
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

function createResizedFilename(originalName: string, format: ExportFormat): string {
  const strippedName = originalName.replace(/\.[^.]+$/, '') || 'image';
  return `${strippedName}-resized.${extensionForFormat(format)}`;
}

function renderResizedImage(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  width: number,
  height: number
) {
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('The browser could not prepare the preview.');
  }

  context.clearRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
}

export function PhotoResizerTool() {
  const [imageAsset, setImageAsset] = useState<ImageAsset | null>(null);
  const [widthInput, setWidthInput] = useState('');
  const [heightInput, setHeightInput] = useState('');
  const [lockAspectRatio, setLockAspectRatio] = useState(true);
  const [outputFormat, setOutputFormat] = useState<ExportFormat>('jpeg');
  const [isBusy, setIsBusy] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ResizerConfirmAction>(null);
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

  const originalAspectRatio = imageAsset ? imageAsset.width / imageAsset.height : null;
  const parsedWidth = Number.parseInt(widthInput, 10);
  const parsedHeight = Number.parseInt(heightInput, 10);
  const hasValidSize = Number.isFinite(parsedWidth) && parsedWidth > 0 && Number.isFinite(parsedHeight) && parsedHeight > 0;
  const resizedDimensions = hasValidSize ? { width: parsedWidth, height: parsedHeight } : null;

  useEffect(() => {
    if (!imageAsset || !previewCanvasRef.current || !resizedDimensions) {
      return;
    }

    const previewSize = getPreviewSize(resizedDimensions.width, resizedDimensions.height);
    renderResizedImage(
      previewCanvasRef.current,
      imageAsset.image,
      previewSize.width,
      previewSize.height
    );
  }, [imageAsset, resizedDimensions]);

  useEffect(() => {
    if (!imageAsset || !exportPreviewCanvasRef.current || !resizedDimensions) {
      return;
    }

    const previewSize = getPreviewSize(resizedDimensions.width, resizedDimensions.height);
    renderResizedImage(
      exportPreviewCanvasRef.current,
      imageAsset.image,
      previewSize.width,
      previewSize.height
    );
  }, [imageAsset, resizedDimensions]);

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
      setWidthInput(String(nextAsset.width));
      setHeightInput(String(nextAsset.height));
      setLockAspectRatio(true);
      setOutputFormat(inferResizeFormat(nextAsset));
      setStatusMessage('Image ready to resize.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'The image could not be loaded.');
      setStatusMessage(null);
    } finally {
      setIsBusy(false);
    }
  };

  const handleWidthChange = (value: string) => {
    setWidthInput(value);
    if (!lockAspectRatio || !originalAspectRatio) {
      return;
    }

    const parsedValue = Number.parseInt(value, 10);
    if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
      return;
    }

    setHeightInput(String(Math.max(1, Math.round(parsedValue / originalAspectRatio))));
  };

  const handleHeightChange = (value: string) => {
    setHeightInput(value);
    if (!lockAspectRatio || !originalAspectRatio) {
      return;
    }

    const parsedValue = Number.parseInt(value, 10);
    if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
      return;
    }

    setWidthInput(String(Math.max(1, Math.round(parsedValue * originalAspectRatio))));
  };

  const runExport = async (action: 'download' | 'share') => {
    if (!imageAsset || !exportCanvasRef.current || !resizedDimensions) {
      setErrorMessage('Choose an image and set a valid size before saving it.');
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);
    setStatusMessage('Saving resized image...');

    try {
      renderResizedImage(
        exportCanvasRef.current,
        imageAsset.image,
        resizedDimensions.width,
        resizedDimensions.height
      );

      const blob = await exportCanvasToBlob(exportCanvasRef.current, outputFormat, 0.94);
      const filename = createResizedFilename(imageAsset.name, outputFormat);

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
      setErrorMessage(error instanceof Error ? error.message : 'The image could not be resized.');
      setStatusMessage(null);
    } finally {
      setIsBusy(false);
    }
  };

  const handleSendToCompressor = async () => {
    if (!imageAsset || !exportCanvasRef.current || !resizedDimensions) {
      setErrorMessage('Choose an image and set a valid size before sending it to compression.');
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);
    setStatusMessage('Preparing resized image for compression...');

    try {
      renderResizedImage(
        exportCanvasRef.current,
        imageAsset.image,
        resizedDimensions.width,
        resizedDimensions.height
      );

      const blob = await exportCanvasToBlob(exportCanvasRef.current, outputFormat, 0.94);
      const filename = createResizedFilename(imageAsset.name, outputFormat);
      const file = new File([blob], filename, { type: blob.type });
      await saveCompressorHandoff(file);
      window.history.pushState({}, '', '/compress');
      window.dispatchEvent(new PopStateEvent('popstate'));
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'The resized image could not be sent into compression.'
      );
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
    setWidthInput('');
    setHeightInput('');
    setLockAspectRatio(true);
    setStatusMessage('Ready for another image.');
  };

  return (
    <>
      <section className="hero">
        <div className="hero-copy-block">
          <div>
            <p className="eyebrow">Photo Resizer</p>
            <h1>Resize images for sharing, websites, and email.</h1>
            <p className="hero-copy">
              Change image dimensions right in your browser with a simple size workflow and no uploads.
            </p>
            <div className="hero-tags" aria-label="Photo resizer highlights">
              <span className="hero-tag">Width and height</span>
              <span className="hero-tag">Aspect ratio lock</span>
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
              Resize first, then move into compression if you want a smaller file too.
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
                {resizedDimensions ? (
                  <span className="dimension-badge">
                    {resizedDimensions.width} × {resizedDimensions.height}px
                  </span>
                ) : null}
              </div>
              <div className="preview-shell watermark-preview-shell">
                {imageAsset && resizedDimensions ? (
                  <canvas ref={previewCanvasRef} className="preview-canvas" aria-label="Resized image preview" />
                ) : (
                  <div className="preview-placeholder">
                    <p>Your resized preview will appear here after you choose a photo.</p>
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
                <h2>Set new size</h2>
              </div>
            </div>
            <div className="controls-grid">
              <label className="field">
                <span>Width</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={widthInput}
                  onChange={(event) => handleWidthChange(event.target.value)}
                  disabled={!imageAsset || isBusy}
                />
              </label>
              <label className="field">
                <span>Height</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={heightInput}
                  onChange={(event) => handleHeightChange(event.target.value)}
                  disabled={!imageAsset || isBusy}
                />
              </label>
              <label className="check-field field-full">
                <input
                  type="checkbox"
                  checked={lockAspectRatio}
                  onChange={(event) => setLockAspectRatio(event.target.checked)}
                  disabled={!imageAsset || isBusy}
                />
                <span>Keep original proportions</span>
              </label>
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
                <span>New size</span>
                <p className="helper-text">
                  {resizedDimensions
                    ? `${resizedDimensions.width} × ${resizedDimensions.height}px`
                    : 'Enter a valid width and height.'}
                </p>
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
            {imageAsset && resizedDimensions ? (
              <div className="export-preview-block">
                <p className="helper-text export-preview-label">Preview</p>
                <div className="preview-shell export-preview-shell">
                  <canvas
                    ref={exportPreviewCanvasRef}
                    className="preview-canvas"
                    aria-label="Final resized image preview"
                  />
                </div>
                <div className="tip-note panel-description panel-description-tight" role="note">
                  <span className="tip-note-icon" aria-hidden="true">
                    i
                  </span>
                  <p className="helper-text">
                    Resized images keep the new pixel size you chose and save as {formatLabel(outputFormat)}.
                  </p>
                </div>
              </div>
            ) : null}
            <div className="export-actions">
              <button
                type="button"
                className="primary-button"
                onClick={() => runExport('download')}
                disabled={!imageAsset || !resizedDimensions || isBusy}
              >
                Save Image
              </button>
              {canNativeShare ? (
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => runExport('share')}
                  disabled={!imageAsset || !resizedDimensions || isBusy}
                >
                  Share / Save to Photos
                </button>
              ) : null}
              <button
                type="button"
                className="ghost-button"
                onClick={handleSendToCompressor}
                disabled={!imageAsset || !resizedDimensions || isBusy}
              >
                Compress this image
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={() => setConfirmAction('clear')}
                disabled={!imageAsset || isBusy}
              >
                Start a New Resize
              </button>
            </div>
          </section>
        </div>
      </section>

      <canvas ref={exportCanvasRef} className="sr-only" aria-hidden="true" />
      <ConfirmModal
        open={confirmAction !== null}
        title="Start a new resize?"
        message="This will remove the current image and preview so you can choose a different file."
        confirmLabel="Start New Resize"
        onConfirm={handleChooseAnotherPhoto}
        onCancel={() => setConfirmAction(null)}
      />
    </>
  );
}
