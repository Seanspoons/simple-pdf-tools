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
import {
  inspectImageMetadata,
  MetadataGroup,
  MetadataInspection
} from '../../utils/metadata';
import { ExportFormat, ImageAsset } from '../../types';

type MetadataConfirmAction = 'clear' | null;

interface CleanedResult {
  blob: Blob;
  filename: string;
  fileSize: number;
  inspection: MetadataInspection;
  removedMessages: string[];
}

function getPreviewSize(width: number, height: number): { width: number; height: number } {
  const maxWidth = 960;
  const maxHeight = 720;
  const scale = Math.min(maxWidth / width, maxHeight / height, 1);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  };
}

function inferOutputFormat(asset: ImageAsset): ExportFormat {
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

function createCleanedFilename(originalName: string, format: ExportFormat): string {
  const strippedName = originalName.replace(/\.[^.]+$/, '') || 'image';
  return `${strippedName}-cleaned.${extensionForFormat(format)}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
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

function renderImage(
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

function buildRemovedMessages(before: MetadataInspection, after: MetadataInspection): string[] {
  const changes: string[] = [];

  for (const beforeItem of before.summary) {
    const afterItem = after.summary.find((item) => item.id === beforeItem.id);
    if (beforeItem.found && afterItem && !afterItem.found) {
      if (beforeItem.id === 'location') {
        changes.push('Location data removed');
      } else if (beforeItem.id === 'camera') {
        changes.push('Camera and device details removed');
      } else if (beforeItem.id === 'datetime') {
        changes.push('Date and time metadata removed');
      } else {
        changes.push('Other embedded metadata removed');
      }
    }
  }

  if (changes.length === 0) {
    changes.push('A fresh exported copy was created without preserving the original metadata block.');
  }

  return changes;
}

function MetadataGroupDetails({ group }: { group: MetadataGroup }) {
  const hasFields = group.fields.length > 0;

  return (
    <details className="metadata-details" open={hasFields}>
      <summary>
        <span>{group.title}</span>
        <span className={`metadata-status-chip ${hasFields ? 'is-found' : ''}`}>
          {hasFields ? `${group.fields.length} found` : 'None found'}
        </span>
      </summary>
      {hasFields ? (
        <dl className="metadata-detail-list">
          {group.fields.map((field) => (
            <div key={`${group.id}-${field.label}`} className="metadata-detail-row">
              <dt>{field.label}</dt>
              <dd>{field.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="helper-text">No details found in this category.</p>
      )}
    </details>
  );
}

export function RemoveMetadataTool() {
  const [imageAsset, setImageAsset] = useState<ImageAsset | null>(null);
  const [inspection, setInspection] = useState<MetadataInspection | null>(null);
  const [cleanedResult, setCleanedResult] = useState<CleanedResult | null>(null);
  const [outputFormat, setOutputFormat] = useState<ExportFormat>('jpeg');
  const [jpegBackground, setJpegBackground] = useState('#ffffff');
  const [hasTransparency, setHasTransparency] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [confirmAction, setConfirmAction] = useState<MetadataConfirmAction>(null);
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
    renderImage(
      previewCanvasRef.current,
      imageAsset.image,
      previewSize.width,
      previewSize.height,
      outputFormat,
      jpegBackground
    );
  }, [imageAsset, outputFormat, jpegBackground]);

  useEffect(() => {
    if (!imageAsset || !cleanedResult || !exportPreviewCanvasRef.current) {
      return;
    }

    const previewSize = getPreviewSize(imageAsset.width, imageAsset.height);
    renderImage(
      exportPreviewCanvasRef.current,
      imageAsset.image,
      previewSize.width,
      previewSize.height,
      outputFormat,
      jpegBackground
    );
  }, [cleanedResult, imageAsset, jpegBackground, outputFormat]);

  useEffect(() => {
    setCleanedResult(null);
  }, [jpegBackground, outputFormat, imageAsset]);

  const imageSummary = useMemo(() => {
    if (!imageAsset) {
      return 'Choose a photo to get started.';
    }

    return `${imageAsset.name} • ${imageAsset.width} × ${imageAsset.height}px`;
  }, [imageAsset]);

  const handleFileSelect = async (file: File) => {
    setIsBusy(true);
    setErrorMessage(null);
    setStatusMessage('Opening image and reading metadata...');

    try {
      const nextAsset = await loadImageAsset(file);
      const nextInspection = await inspectImageMetadata(file, nextAsset);

      setImageAsset((current) => {
        if (current?.objectUrl) {
          URL.revokeObjectURL(current.objectUrl);
        }
        return nextAsset;
      });

      setInspection(nextInspection);
      setOutputFormat(inferOutputFormat(nextAsset));
      setJpegBackground('#ffffff');
      setCleanedResult(null);
      setStatusMessage(
        nextInspection.hasEmbeddedMetadata
          ? 'Metadata loaded and ready to clean.'
          : 'No major embedded metadata was found, but you can still create a clean copy.'
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'The image could not be loaded.');
      setStatusMessage(null);
    } finally {
      setIsBusy(false);
    }
  };

  const prepareCleanedImage = async () => {
    if (!imageAsset || !inspection || !exportCanvasRef.current) {
      setErrorMessage('Choose an image before creating a cleaned copy.');
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);
    setStatusMessage('Creating a cleaned image...');

    try {
      renderImage(
        exportCanvasRef.current,
        imageAsset.image,
        imageAsset.width,
        imageAsset.height,
        outputFormat,
        jpegBackground
      );

      const blob = await exportCanvasToBlob(exportCanvasRef.current, outputFormat, 0.94);
      const filename = createCleanedFilename(imageAsset.name, outputFormat);
      const cleanedFile = new File([blob], filename, { type: blob.type });
      const cleanedInspection = await inspectImageMetadata(cleanedFile, imageAsset);
      const removedMessages = buildRemovedMessages(inspection, cleanedInspection);

      setCleanedResult({
        blob,
        filename,
        fileSize: blob.size,
        inspection: cleanedInspection,
        removedMessages
      });
      setStatusMessage(`${filename} is ready.`);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'The cleaned image could not be prepared.'
      );
      setStatusMessage(null);
    } finally {
      setIsBusy(false);
    }
  };

  const exportCleanedImage = async (action: 'download' | 'share') => {
    if (!cleanedResult) {
      setErrorMessage('Create a cleaned image before saving it.');
      return;
    }

    setErrorMessage(null);

    if (action === 'share') {
      const shared = await shareImageIfPossible(cleanedResult.blob, cleanedResult.filename);
      if (!shared) {
        triggerDownload(cleanedResult.blob, cleanedResult.filename);
      }
      return;
    }

    triggerDownload(cleanedResult.blob, cleanedResult.filename);
  };

  const handleChooseAnotherPhoto = () => {
    setConfirmAction(null);
    setImageAsset((current) => {
      if (current?.objectUrl) {
        URL.revokeObjectURL(current.objectUrl);
      }
      return null;
    });
    setInspection(null);
    setCleanedResult(null);
    setStatusMessage('Ready for another image.');
  };

  return (
    <>
      <section className="hero">
        <div className="hero-copy-block">
          <div>
            <p className="eyebrow">Remove Metadata</p>
            <h1>Remove hidden metadata from images before sharing.</h1>
            <p className="hero-copy">
              Review useful photo details, strip information like location and device metadata, and save a cleaner copy right in your browser.
            </p>
            <div className="hero-tags" aria-label="Remove metadata highlights">
              <span className="hero-tag">Metadata review</span>
              <span className="hero-tag">Privacy focused</span>
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
              This tool helps remove hidden details like location, camera, and capture information before you share a photo.
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
                  <canvas ref={previewCanvasRef} className="preview-canvas" aria-label="Image preview" />
                ) : (
                  <div className="preview-placeholder">
                    <p>Your image preview will appear here after you choose a photo.</p>
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
                <h2>Review metadata</h2>
              </div>
            </div>
            {inspection ? (
              <>
                <div className="metadata-summary-grid">
                  {inspection.summary.map((item) => (
                    <div key={item.id} className="field metadata-summary-card">
                      <span>{item.title}</span>
                      <p className={`metadata-summary-status ${item.found ? 'is-found' : ''}`}>{item.message}</p>
                    </div>
                  ))}
                </div>
                {inspection.parseMessage ? (
                  <div className="tip-note panel-description panel-description-tight" role="note">
                    <span className="tip-note-icon" aria-hidden="true">
                      i
                    </span>
                    <p className="helper-text">{inspection.parseMessage}</p>
                  </div>
                ) : null}
                <div className="metadata-group-stack">
                  {inspection.groups.map((group) => (
                    <MetadataGroupDetails key={group.id} group={group} />
                  ))}
                </div>
              </>
            ) : (
              <p className="helper-text">Choose a photo to inspect its metadata.</p>
            )}
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Step 3</p>
                <h2>Remove metadata</h2>
              </div>
            </div>
            <div className="preview-compare-bar" aria-label="Cleaned image output format">
              <span className="preview-compare-label">Format</span>
              <div className="preview-compare-toggle" role="tablist" aria-label="Cleaned image output format">
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
              <div className="field">
                <span>Current output</span>
                <p className="helper-text">{formatLabel(outputFormat)}</p>
              </div>
              <div className="field">
                <span>What happens</span>
                <p className="helper-text">
                  A fresh exported copy is created so the original embedded metadata is not carried over.
                </p>
              </div>
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
              <div className="field field-full">
                <button
                  type="button"
                  className="primary-button"
                  onClick={prepareCleanedImage}
                  disabled={!imageAsset || !inspection || isBusy}
                >
                  Create Cleaned Image
                </button>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Step 4</p>
                <h2>Download cleaned image</h2>
              </div>
            </div>
            {imageAsset && cleanedResult ? (
              <div className="export-preview-block">
                <p className="helper-text export-preview-label">Preview</p>
                <div className="preview-shell export-preview-shell">
                  <canvas
                    ref={exportPreviewCanvasRef}
                    className="preview-canvas"
                    aria-label="Cleaned image preview"
                  />
                </div>
                <div className="controls-grid">
                  <div className="field">
                    <span>Original file size</span>
                    <p className="helper-text">{formatBytes(imageAsset.file.size)}</p>
                  </div>
                  <div className="field">
                    <span>Cleaned file size</span>
                    <p className="helper-text">{formatBytes(cleanedResult.fileSize)}</p>
                  </div>
                </div>
                <div className="metadata-summary-grid">
                  {cleanedResult.removedMessages.map((message) => (
                    <div key={message} className="field metadata-summary-card">
                      <span>Removed</span>
                      <p className="metadata-summary-status is-found">{message}</p>
                    </div>
                  ))}
                </div>
                <div className="metadata-group-stack">
                  {cleanedResult.inspection.groups
                    .filter((group) => group.id !== 'file')
                    .map((group) => (
                      <MetadataGroupDetails key={`after-${group.id}`} group={group} />
                    ))}
                </div>
              </div>
            ) : (
              <p className="helper-text panel-description">
                Create a cleaned image to review what changed and download the new file.
              </p>
            )}
            <div className="export-actions">
              <button
                type="button"
                className="primary-button"
                onClick={() => exportCleanedImage('download')}
                disabled={!cleanedResult || isBusy}
              >
                Save Cleaned Image
              </button>
              {canNativeShare ? (
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => exportCleanedImage('share')}
                  disabled={!cleanedResult || isBusy}
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
                Start a New Clean
              </button>
            </div>
          </section>
        </div>
      </section>

      <canvas ref={exportCanvasRef} className="sr-only" aria-hidden="true" />
      <ConfirmModal
        open={confirmAction !== null}
        title="Start a new cleanup?"
        message="This will remove the current image and metadata summary so you can choose a different file."
        confirmLabel="Start New Cleanup"
        onConfirm={handleChooseAnotherPhoto}
        onCancel={() => setConfirmAction(null)}
      />
    </>
  );
}
