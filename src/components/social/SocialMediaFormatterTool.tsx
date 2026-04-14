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

type SocialConfirmAction = 'clear' | null;
type SocialFitMode = 'fit' | 'fill';

interface SocialPreset {
  id: string;
  platform: 'Instagram' | 'TikTok' | 'YouTube' | 'LinkedIn' | 'X';
  label: string;
  width: number;
  height: number;
  slug: string;
}

const SOCIAL_PRESETS: SocialPreset[] = [
  { id: 'instagram-square', platform: 'Instagram', label: 'Instagram Square', width: 1080, height: 1080, slug: 'instagram-square' },
  { id: 'instagram-portrait', platform: 'Instagram', label: 'Instagram Portrait', width: 1080, height: 1350, slug: 'instagram-portrait' },
  { id: 'instagram-landscape', platform: 'Instagram', label: 'Instagram Landscape', width: 1080, height: 566, slug: 'instagram-landscape' },
  { id: 'instagram-story', platform: 'Instagram', label: 'Instagram Story / Reel Cover', width: 1080, height: 1920, slug: 'instagram-story' },
  { id: 'tiktok-vertical', platform: 'TikTok', label: 'TikTok Vertical', width: 1080, height: 1920, slug: 'tiktok-vertical' },
  { id: 'youtube-thumbnail', platform: 'YouTube', label: 'YouTube Thumbnail', width: 1280, height: 720, slug: 'youtube-thumbnail' },
  { id: 'linkedin-portrait', platform: 'LinkedIn', label: 'LinkedIn Portrait Post', width: 1080, height: 1350, slug: 'linkedin-portrait' },
  { id: 'linkedin-landscape', platform: 'LinkedIn', label: 'LinkedIn Landscape / Link-style', width: 1200, height: 627, slug: 'linkedin-landscape' },
  { id: 'linkedin-square', platform: 'LinkedIn', label: 'LinkedIn Square', width: 1080, height: 1080, slug: 'linkedin-square' },
  { id: 'x-square', platform: 'X', label: 'X Square', width: 1200, height: 1200, slug: 'x-square' },
  { id: 'x-landscape', platform: 'X', label: 'X Landscape', width: 1200, height: 628, slug: 'x-landscape' },
  { id: 'x-vertical', platform: 'X', label: 'X Vertical', width: 1080, height: 1350, slug: 'x-vertical' }
];

const PRESET_GROUPS = ['Instagram', 'TikTok', 'YouTube', 'LinkedIn', 'X'] as const;

function getPreviewSize(width: number, height: number): { width: number; height: number } {
  const maxWidth = 960;
  const maxHeight = 720;
  const scale = Math.min(maxWidth / width, maxHeight / height, 1);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  };
}

function inferFormatterFormat(asset: ImageAsset): ExportFormat {
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

function createFormattedFilename(originalName: string, preset: SocialPreset, format: ExportFormat): string {
  const strippedName = originalName.replace(/\.[^.]+$/, '') || 'image';
  return `${strippedName}-${preset.slug}.${extensionForFormat(format)}`;
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

function getPresetPreviewStyle(preset: SocialPreset) {
  const maxSize = 56;
  const aspectRatio = preset.width / preset.height;

  if (aspectRatio >= 1) {
    return {
      width: `${maxSize}px`,
      height: `${Math.max(18, Math.round(maxSize / aspectRatio))}px`
    };
  }

  return {
    width: `${Math.max(18, Math.round(maxSize * aspectRatio))}px`,
    height: `${maxSize}px`
  };
}

function renderFormattedImage(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  preset: SocialPreset,
  fitMode: SocialFitMode,
  paddingPercent: number,
  backgroundColor: string,
  fillBackground: boolean,
  offsetX: number,
  offsetY: number
) {
  canvas.width = preset.width;
  canvas.height = preset.height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('The browser could not prepare the preview.');
  }

  context.clearRect(0, 0, preset.width, preset.height);

  if (fillBackground) {
    context.fillStyle = backgroundColor;
    context.fillRect(0, 0, preset.width, preset.height);
  }

  const padding = fitMode === 'fit' ? Math.round((Math.min(preset.width, preset.height) * paddingPercent) / 100) : 0;
  const targetWidth = Math.max(1, preset.width - padding * 2);
  const targetHeight = Math.max(1, preset.height - padding * 2);
  const scale = fitMode === 'fill'
    ? Math.max(targetWidth / image.width, targetHeight / image.height)
    : Math.min(targetWidth / image.width, targetHeight / image.height);

  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const availableX = preset.width - drawWidth;
  const availableY = preset.height - drawHeight;
  const drawX = availableX / 2 + (availableX / 2) * (offsetX / 100);
  const drawY = availableY / 2 + (availableY / 2) * (offsetY / 100);

  context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
}

export function SocialMediaFormatterTool() {
  const [imageAsset, setImageAsset] = useState<ImageAsset | null>(null);
  const [selectedPresetId, setSelectedPresetId] = useState<string>(SOCIAL_PRESETS[0].id);
  const [fitMode, setFitMode] = useState<SocialFitMode>('fit');
  const [paddingPercent, setPaddingPercent] = useState(6);
  const [backgroundColor, setBackgroundColor] = useState('#ffffff');
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [outputFormat, setOutputFormat] = useState<ExportFormat>('jpeg');
  const [useTransparentBackground, setUseTransparentBackground] = useState(false);
  const [hasTransparency, setHasTransparency] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [confirmAction, setConfirmAction] = useState<SocialConfirmAction>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const exportPreviewCanvasRef = useRef<HTMLCanvasElement>(null);
  const exportCanvasRef = useRef<HTMLCanvasElement>(null);

  const selectedPreset = useMemo(
    () => SOCIAL_PRESETS.find((preset) => preset.id === selectedPresetId) ?? SOCIAL_PRESETS[0],
    [selectedPresetId]
  );

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
    if (outputFormat === 'jpeg') {
      setUseTransparentBackground(false);
    }
  }, [outputFormat]);

  const shouldFillBackground = outputFormat === 'jpeg' || !useTransparentBackground;
  const willUpscale = useMemo(() => {
    if (!imageAsset) {
      return false;
    }

    return imageAsset.width < selectedPreset.width || imageAsset.height < selectedPreset.height;
  }, [imageAsset, selectedPreset.height, selectedPreset.width]);

  useEffect(() => {
    if (!imageAsset || !previewCanvasRef.current) {
      return;
    }

    const previewSize = getPreviewSize(selectedPreset.width, selectedPreset.height);
    renderFormattedImage(
      previewCanvasRef.current,
      imageAsset.image,
      { ...selectedPreset, width: previewSize.width, height: previewSize.height },
      fitMode,
      paddingPercent,
      backgroundColor,
      shouldFillBackground,
      offsetX,
      offsetY
    );
  }, [backgroundColor, fitMode, imageAsset, offsetX, offsetY, paddingPercent, selectedPreset, shouldFillBackground]);

  useEffect(() => {
    if (!imageAsset || !exportPreviewCanvasRef.current) {
      return;
    }

    const previewSize = getPreviewSize(selectedPreset.width, selectedPreset.height);
    renderFormattedImage(
      exportPreviewCanvasRef.current,
      imageAsset.image,
      { ...selectedPreset, width: previewSize.width, height: previewSize.height },
      fitMode,
      paddingPercent,
      backgroundColor,
      shouldFillBackground,
      offsetX,
      offsetY
    );
  }, [backgroundColor, fitMode, imageAsset, offsetX, offsetY, paddingPercent, selectedPreset, shouldFillBackground]);

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
      const nextFormat = inferFormatterFormat(nextAsset);
      setOutputFormat(nextFormat);
      setUseTransparentBackground(nextFormat !== 'jpeg');
      setOffsetX(0);
      setOffsetY(0);
      setPaddingPercent(6);
      setFitMode('fit');
      setStatusMessage('Image ready to format.');
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
    setStatusMessage('Saving formatted image...');

    try {
      renderFormattedImage(
        exportCanvasRef.current,
        imageAsset.image,
        selectedPreset,
        fitMode,
        paddingPercent,
        backgroundColor,
        shouldFillBackground,
        offsetX,
        offsetY
      );

      const blob = await exportCanvasToBlob(exportCanvasRef.current, outputFormat, 0.94);
      const filename = createFormattedFilename(imageAsset.name, selectedPreset, outputFormat);

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
      setErrorMessage(error instanceof Error ? error.message : 'The formatted image could not be saved.');
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
    setOffsetX(0);
    setOffsetY(0);
    setPaddingPercent(6);
    setFitMode('fit');
    setStatusMessage('Ready for another image.');
  };

  const resetFormatting = () => {
    setFitMode('fit');
    setPaddingPercent(6);
    setBackgroundColor('#ffffff');
    setOffsetX(0);
    setOffsetY(0);
    if (outputFormat !== 'jpeg') {
      setUseTransparentBackground(true);
    }
    setStatusMessage('Formatting reset.');
  };

  return (
    <>
      <section className="hero">
        <div className="hero-copy-block">
          <div>
            <p className="eyebrow">Social Media Formatter</p>
            <h1>Format images for Instagram, TikTok, LinkedIn, X, and more.</h1>
            <p className="hero-copy">
              Make your image fit the right size for each platform with simple presets, live preview, and private export.
            </p>
            <div className="hero-tags" aria-label="Social media formatter highlights">
              <span className="hero-tag">Platform presets</span>
              <span className="hero-tag">Fit or fill</span>
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
              Pick a preset first, then decide whether the image should fit inside the canvas or fill it edge to edge.
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
                  <h2>Your layout</h2>
                </div>
                <span className="dimension-badge">
                  {selectedPreset.width} × {selectedPreset.height}px
                </span>
              </div>
              <div className="preview-shell watermark-preview-shell">
                {imageAsset ? (
                  <canvas ref={previewCanvasRef} className="preview-canvas" aria-label="Formatted social media preview" />
                ) : (
                  <div className="preview-placeholder">
                    <p>Your formatted preview will appear here after you choose a photo.</p>
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
                <h2>Choose platform and format</h2>
              </div>
            </div>
            <div className="social-preset-stack">
              {PRESET_GROUPS.map((platform) => (
                <div key={platform} className="social-preset-group">
                  <p className="social-preset-platform">{platform}</p>
                  <div className="output-choice-grid">
                    {SOCIAL_PRESETS.filter((preset) => preset.platform === platform).map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        className={`output-choice-card ${selectedPreset.id === preset.id ? 'is-active' : ''}`}
                        onClick={() => setSelectedPresetId(preset.id)}
                        disabled={isBusy}
                      >
                        <span className="output-preview social-output-preview" style={getPresetPreviewStyle(preset)} />
                        <span className="social-preset-card-copy">
                          <span className="social-preset-card-title">{preset.label}</span>
                          <span className="social-preset-card-dimensions">
                            {preset.width} × {preset.height}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Step 3</p>
                <h2>Adjust fit and background</h2>
              </div>
            </div>
            <div className="preview-compare-bar" aria-label="Image fit mode">
              <span className="preview-compare-label">Fit mode</span>
              <div className="preview-compare-toggle" role="tablist" aria-label="Image fit mode">
                {(['fit', 'fill'] as SocialFitMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    role="tab"
                    aria-selected={fitMode === mode}
                    className={`preview-compare-button ${fitMode === mode ? 'is-active' : ''}`}
                    onClick={() => setFitMode(mode)}
                    disabled={isBusy}
                  >
                    {mode === 'fit' ? 'Fit' : 'Fill'}
                  </button>
                ))}
              </div>
            </div>

            <div className="controls-grid">
              {fitMode === 'fit' ? (
                <label className="field field-full">
                  <span>Padding</span>
                  <input
                    type="range"
                    min="0"
                    max="20"
                    step="1"
                    value={paddingPercent}
                    onChange={(event) => setPaddingPercent(Number(event.target.value))}
                    disabled={!imageAsset || isBusy}
                  />
                  <p className="helper-text">
                    Less edge space <strong>{paddingPercent}%</strong> More padding
                  </p>
                </label>
              ) : null}

              <label className="field">
                <span>Horizontal position</span>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  step="1"
                  value={offsetX}
                  onChange={(event) => setOffsetX(Number(event.target.value))}
                  disabled={!imageAsset || isBusy}
                />
                <p className="helper-text">
                  Left <strong>{offsetX}</strong> Right
                </p>
              </label>

              <label className="field">
                <span>Vertical position</span>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  step="1"
                  value={offsetY}
                  onChange={(event) => setOffsetY(Number(event.target.value))}
                  disabled={!imageAsset || isBusy}
                />
                <p className="helper-text">
                  Up <strong>{offsetY}</strong> Down
                </p>
              </label>

              <label className="field field-full">
                <span>Background color</span>
                <input
                  type="color"
                  value={backgroundColor}
                  onChange={(event) => setBackgroundColor(event.target.value)}
                  disabled={isBusy}
                />
                <p className="helper-text">
                  Use a solid canvas color behind the image when you need space around it.
                </p>
              </label>

              {outputFormat !== 'jpeg' ? (
                <label className="check-field field-full">
                  <input
                    type="checkbox"
                    checked={useTransparentBackground}
                    onChange={(event) => setUseTransparentBackground(event.target.checked)}
                    disabled={isBusy}
                  />
                  <span>Keep canvas background transparent when possible</span>
                </label>
              ) : null}

              <div className="field">
                <span>Preset</span>
                <p className="helper-text">{selectedPreset.label}</p>
              </div>
              <div className="field">
                <span>Canvas</span>
                <p className="helper-text">
                  {selectedPreset.width} × {selectedPreset.height}px
                </p>
              </div>
              <div className="field field-full">
                <button
                  type="button"
                  className="ghost-button"
                  onClick={resetFormatting}
                  disabled={!imageAsset || isBusy}
                >
                  Reset Formatting
                </button>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Step 4</p>
                <h2>Download image</h2>
              </div>
            </div>
            <div className="preview-compare-bar" aria-label="Formatter output format">
              <span className="preview-compare-label">Save as</span>
              <div className="preview-compare-toggle" role="tablist" aria-label="Formatter output format">
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

            {imageAsset ? (
              <div className="export-preview-block">
                <p className="helper-text export-preview-label">Preview</p>
                <div className="preview-shell export-preview-shell">
                  <canvas
                    ref={exportPreviewCanvasRef}
                    className="preview-canvas"
                    aria-label="Final social media image preview"
                  />
                </div>
                <div className="tip-note panel-description panel-description-tight" role="note">
                  <span className="tip-note-icon" aria-hidden="true">
                    i
                  </span>
                  <p className="helper-text">
                    The final image saves at the exact preset size you picked for {selectedPreset.platform}.
                  </p>
                </div>
                {willUpscale ? (
                  <div className="tip-note panel-description panel-description-tight" role="note">
                    <span className="tip-note-icon" aria-hidden="true">
                      i
                    </span>
                    <p className="helper-text">
                      This preset is larger than your original image, so the saved result will be upscaled.
                    </p>
                  </div>
                ) : null}
                {outputFormat === 'jpeg' && hasTransparency ? (
                  <div className="tip-note panel-description panel-description-tight" role="note">
                    <span className="tip-note-icon" aria-hidden="true">
                      i
                    </span>
                    <p className="helper-text">
                      JPEG does not support transparency, so transparent areas will use your background color.
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="export-actions">
              <button
                type="button"
                className="primary-button"
                onClick={() => runExport('download')}
                disabled={!imageAsset || isBusy}
              >
                Save Image
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
                Start a New Format
              </button>
            </div>
          </section>
        </div>
      </section>

      <canvas ref={exportCanvasRef} className="sr-only" aria-hidden="true" />
      <ConfirmModal
        open={confirmAction !== null}
        title="Start a new format?"
        message="This will remove the current image and preview so you can choose a different file."
        confirmLabel="Start New Format"
        onConfirm={handleChooseAnotherPhoto}
        onCancel={() => setConfirmAction(null)}
      />
    </>
  );
}
