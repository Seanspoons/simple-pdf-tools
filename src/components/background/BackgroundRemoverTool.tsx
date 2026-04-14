import { useEffect, useMemo, useRef, useState } from 'react';
import { ConfirmModal } from '../ConfirmModal';
import { FloatingMessage } from '../FloatingMessage';
import { UploadPanel } from '../UploadPanel';
import { exportCanvasToBlob, triggerDownload } from '../../utils/exportImage';
import { loadImageAsset } from '../../utils/imageLoader';
import { preloadBackgroundRemoval } from '../../utils/backgroundRemoval';
import {
  BackgroundRemovalMode,
  BackgroundRemovalRefinementSettings,
  processBackgroundRemoval
} from '../../utils/backgroundRemovalQuality';
import {
  BackgroundFillMode,
  BackgroundPreviewMode,
  clearBackgroundRemoverDraft,
  loadBackgroundRemoverDraft,
  saveBackgroundRemoverDraft
} from '../../utils/background/draftStorage';
import { ImageAsset } from '../../types';

type BackgroundRemoverConfirmAction = 'clear' | null;
type ModelStatus = 'loading' | 'ready' | 'error';

interface LoadedBlobImage {
  image: HTMLImageElement;
  objectUrl: string;
}

const PHOTO_REFINEMENT_DEFAULTS = {
  edgeSoftness: 0.45,
  edgeCleanup: 0.35,
  thresholdBias: 0
};

const GRAPHIC_REFINEMENT_DEFAULTS = {
  edgeSoftness: 0.08,
  edgeCleanup: 0.75,
  thresholdBias: 0.18
};

function getDefaultRefinementSettings(
  mode: BackgroundRemovalMode
): BackgroundRemovalRefinementSettings {
  return mode === 'photo' ? PHOTO_REFINEMENT_DEFAULTS : GRAPHIC_REFINEMENT_DEFAULTS;
}

function normalizePreviewMode(value: string | null | undefined): BackgroundPreviewMode {
  return value === 'before' ? 'before' : 'after';
}

function normalizeBackgroundFillMode(value: string | null | undefined): BackgroundFillMode {
  return value === 'white' || value === 'color' ? value : 'transparent';
}

function normalizePreviewZoom(value: number | null | undefined) {
  return value === 2 || value === 3 ? value : 1;
}

function normalizeRefinementSettings(
  mode: BackgroundRemovalMode,
  value: Partial<BackgroundRemovalRefinementSettings> | null | undefined
): BackgroundRemovalRefinementSettings {
  return {
    ...getDefaultRefinementSettings(mode),
    ...value
  };
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

function renderImageWithBackground(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  width: number,
  height: number,
  fillMode: BackgroundFillMode,
  fillColor: string
) {
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('The browser could not prepare the preview.');
  }

  context.clearRect(0, 0, width, height);

  if (fillMode === 'white' || fillMode === 'color') {
    context.fillStyle = fillMode === 'white' ? '#ffffff' : fillColor;
    context.fillRect(0, 0, width, height);
  }

  context.drawImage(image, 0, 0, width, height);
}

function formatModelAssetLabel(key: string): string {
  if (key.includes('model')) {
    return 'Downloading model';
  }

  if (key.includes('wasm')) {
    return 'Preparing runtime';
  }

  if (key.includes('worker')) {
    return 'Starting worker';
  }

  return 'Preparing model';
}

function loadBlobImage(blob: Blob): Promise<LoadedBlobImage> {
  const objectUrl = URL.createObjectURL(blob);

  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ image, objectUrl });
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('The cutout preview could not be prepared.'));
    };
    image.src = objectUrl;
  });
}

export function BackgroundRemoverTool() {
  const [imageAsset, setImageAsset] = useState<ImageAsset | null>(null);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [resultPreview, setResultPreview] = useState<LoadedBlobImage | null>(null);
  const [previewMode, setPreviewMode] = useState<BackgroundPreviewMode>('after');
  const [previewZoom, setPreviewZoom] = useState(1);
  const [removalMode, setRemovalMode] = useState<BackgroundRemovalMode>('photo');
  const [refinementSettings, setRefinementSettings] = useState(PHOTO_REFINEMENT_DEFAULTS);
  const [backgroundFillMode, setBackgroundFillMode] = useState<BackgroundFillMode>('transparent');
  const [backgroundColor, setBackgroundColor] = useState('#ffffff');
  const [modelStatus, setModelStatus] = useState<ModelStatus>('loading');
  const [modelStage, setModelStage] = useState('Preparing model in your browser...');
  const [modelProgress, setModelProgress] = useState<number | null>(null);
  const [modelReloadToken, setModelReloadToken] = useState(0);
  const [isBusy, setIsBusy] = useState(false);
  const [hasLoadedDraft, setHasLoadedDraft] = useState(false);
  const [confirmAction, setConfirmAction] = useState<BackgroundRemoverConfirmAction>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>('Loading background remover...');
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const exportCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let isCancelled = false;

    async function restoreDraft() {
      try {
        const draft = await loadBackgroundRemoverDraft();
        if (!draft || !draft.file || isCancelled) {
          setHasLoadedDraft(true);
          return;
        }

        const restoredAsset = await loadImageAsset(draft.file);
        if (isCancelled) {
          URL.revokeObjectURL(restoredAsset.objectUrl);
          return;
        }

        const nextRemovalMode = draft.removalMode === 'graphic' ? 'graphic' : 'photo';
        setImageAsset((current) => {
          if (current?.objectUrl) {
            URL.revokeObjectURL(current.objectUrl);
          }

          return restoredAsset;
        });
        setRemovalMode(nextRemovalMode);
        setRefinementSettings(normalizeRefinementSettings(nextRemovalMode, draft.refinementSettings));
        setPreviewMode(normalizePreviewMode(draft.previewMode));
        setPreviewZoom(normalizePreviewZoom(draft.previewZoom));
        setBackgroundFillMode(normalizeBackgroundFillMode(draft.backgroundFillMode));
        setBackgroundColor(draft.backgroundColor || '#ffffff');
        setStatusMessage('Restored your last photo.');
      } catch {
        if (!isCancelled) {
          setErrorMessage('Your last background remover photo could not be restored.');
        }
      } finally {
        if (!isCancelled) {
          setHasLoadedDraft(true);
        }
      }
    }

    void restoreDraft();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;

    async function prepareModel() {
      try {
        setModelStatus('loading');
        setModelStage('Preparing model in your browser...');
        setModelProgress(null);
        await preloadBackgroundRemoval((key, current, total) => {
          if (isCancelled) {
            return;
          }

          setModelStage(`${formatModelAssetLabel(key)}...`);
          setModelProgress(total > 0 ? current / total : null);
        });

        if (isCancelled) {
          return;
        }

        setModelStatus('ready');
        setModelStage('Model ready in your browser.');
        setModelProgress(1);
        setStatusMessage('Background remover is ready.');
      } catch (error) {
        if (isCancelled) {
          return;
        }

        setModelStatus('error');
        setModelStage('The background remover could not load.');
        setModelProgress(null);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'The background remover could not load in this browser.'
        );
        setStatusMessage(null);
      }
    }

    void prepareModel();

    return () => {
      isCancelled = true;
    };
  }, [modelReloadToken]);

  useEffect(() => {
    return () => {
      if (imageAsset?.objectUrl) {
        URL.revokeObjectURL(imageAsset.objectUrl);
      }
    };
  }, [imageAsset]);

  useEffect(() => {
    return () => {
      if (resultPreview?.objectUrl) {
        URL.revokeObjectURL(resultPreview.objectUrl);
      }
    };
  }, [resultPreview]);

  useEffect(() => {
    if (!hasLoadedDraft) {
      return;
    }

    if (!imageAsset?.file) {
      void clearBackgroundRemoverDraft();
      return;
    }

    void saveBackgroundRemoverDraft(
      imageAsset.file,
      resultBlob ? previewMode : 'before',
      previewZoom,
      removalMode,
      refinementSettings,
      backgroundFillMode,
      backgroundColor
    );
  }, [
    backgroundColor,
    backgroundFillMode,
    hasLoadedDraft,
    imageAsset,
    previewMode,
    previewZoom,
    refinementSettings,
    removalMode,
    resultBlob
  ]);

  useEffect(() => {
    const activeImage = previewMode === 'before' ? imageAsset?.image ?? null : resultPreview?.image ?? null;
    if (!activeImage || !previewCanvasRef.current) {
      return;
    }

    const previewSize = getPreviewSize(activeImage.naturalWidth, activeImage.naturalHeight);
    renderImageWithBackground(
      previewCanvasRef.current,
      activeImage,
      previewSize.width,
      previewSize.height,
      previewMode === 'after' ? backgroundFillMode : 'transparent',
      backgroundColor
    );
  }, [backgroundColor, backgroundFillMode, imageAsset, previewMode, resultPreview]);

  const imageSummary = useMemo(() => {
    if (!imageAsset) {
      return 'Choose a photo to remove the background.';
    }

    return `${imageAsset.name} • ${imageAsset.width} × ${imageAsset.height}px`;
  }, [imageAsset]);
  const imageMegapixels = imageAsset ? (imageAsset.width * imageAsset.height) / 1000000 : 0;
  const mayTakeLonger = imageMegapixels >= 12;

  const canRunRemoval = imageAsset !== null && modelStatus === 'ready' && !isBusy;

  const handleRemovalModeChange = (nextMode: BackgroundRemovalMode) => {
    setRemovalMode(nextMode);
    setRefinementSettings(getDefaultRefinementSettings(nextMode));

    if (resultBlob) {
      setStatusMessage(
        nextMode === 'photo'
          ? 'Switched to Photo mode. Run background removal again to refresh the cutout.'
          : 'Switched to Logo / Graphic mode. Run background removal again to refresh the cutout.'
      );
    }
  };

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
      setResultBlob(null);
      setResultPreview((current) => {
        if (current?.objectUrl) {
          URL.revokeObjectURL(current.objectUrl);
        }

        return null;
      });
      setPreviewMode('before');
      setPreviewZoom(1);
      setRemovalMode('photo');
      setRefinementSettings(getDefaultRefinementSettings('photo'));
      setBackgroundFillMode('transparent');
      setBackgroundColor('#ffffff');
      setStatusMessage(
        modelStatus === 'ready'
          ? 'Image ready. Remove the background when you are ready.'
          : 'Image ready. The model is still preparing in your browser.'
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'The image could not be loaded.');
      setStatusMessage(null);
    } finally {
      setIsBusy(false);
    }
  };

  const handleRemoveBackground = async () => {
    if (!imageAsset) {
      setErrorMessage('Choose a photo before removing the background.');
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);
    setStatusMessage('Removing background...');

    try {
      const { blob: nextBlob } = await processBackgroundRemoval(
        imageAsset,
        removalMode,
        refinementSettings,
        (key, current, total) => {
        setModelStage(`${formatModelAssetLabel(key)}...`);
        setModelProgress(total > 0 ? current / total : null);
        }
      );
      const nextPreview = await loadBlobImage(nextBlob);

      setResultPreview((current) => {
        if (current?.objectUrl) {
          URL.revokeObjectURL(current.objectUrl);
        }

        return nextPreview;
      });
      setResultBlob(nextBlob);
      setPreviewMode('after');
      setStatusMessage(
        removalMode === 'photo'
          ? 'Background removed in Photo mode. Review the transparent cutout.'
          : 'Background removed in Logo / Graphic mode. Review the transparent cutout.'
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'The background could not be removed from this image.'
      );
      setStatusMessage('Your original photo is still ready to try again.');
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
    setResultPreview((current) => {
      if (current?.objectUrl) {
        URL.revokeObjectURL(current.objectUrl);
      }

      return null;
    });
    setResultBlob(null);
    setPreviewMode('after');
    setPreviewZoom(1);
    setRemovalMode('photo');
    setRefinementSettings(getDefaultRefinementSettings('photo'));
    setBackgroundFillMode('transparent');
    setBackgroundColor('#ffffff');
    setStatusMessage('Ready for another image.');
    void clearBackgroundRemoverDraft();
  };

  const handleDownload = async () => {
    if (!resultBlob || !resultPreview) {
      setErrorMessage('Remove the background before downloading the result.');
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);
    setStatusMessage('Preparing download...');

    try {
      let blob = resultBlob;

      if (backgroundFillMode !== 'transparent') {
        if (!exportCanvasRef.current) {
          throw new Error('The browser could not prepare the export.');
        }

        renderImageWithBackground(
          exportCanvasRef.current,
          resultPreview.image,
          resultPreview.image.naturalWidth,
          resultPreview.image.naturalHeight,
          backgroundFillMode,
          backgroundColor
        );
        blob = await exportCanvasToBlob(exportCanvasRef.current, 'png', 1);
      }

      const filenameBase = imageAsset?.name.replace(/\.[^.]+$/, '') || 'photo';
      const suffix =
        backgroundFillMode === 'transparent'
          ? 'no-background'
          : backgroundFillMode === 'white'
            ? 'white-background'
            : 'custom-background';
      const filename = `${filenameBase}-${suffix}.png`;
      triggerDownload(blob, filename);
      setStatusMessage(`Saved ${filename}.`);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'The result could not be downloaded.'
      );
      setStatusMessage(null);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <>
      <section className="hero">
        <div className="hero-copy-block">
          <div>
            <p className="eyebrow">Background Remover</p>
            <h1>Remove photo backgrounds directly in your browser.</h1>
            <p className="hero-copy">
              Create transparent cutouts without uploading your image. No accounts. No server
              processing. Private by default.
            </p>
            <div className="hero-tags" aria-label="Background remover highlights">
              <span className="hero-tag">Transparent cutouts</span>
              <span className="hero-tag">Private in browser</span>
              <span className="hero-tag">PNG download</span>
            </div>
          </div>
        </div>
        <div className="hero-card">
          <p className="hero-stat-label">Your photo</p>
          <p className="hero-stat">{imageSummary}</p>
          <div className="tip-note" role="note">
            <span className="tip-note-icon" aria-hidden="true">
              i
            </span>
            <p className="helper-text">
              Start with one photo. The model runs entirely in your browser and keeps your image on
              your device.
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

      <section className="layout-grid background-remover-layout-grid">
        <div className="left-column">
          <UploadPanel
            onFileSelect={handleFileSelect}
            disabled={isBusy}
            fileName={imageAsset?.name}
          />
          <div className="preview-sticky-wrap">
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Step 2</p>
                  <h2>Remove the background</h2>
                </div>
                <span className="dimension-badge">
                  {modelStatus === 'ready'
                    ? 'Model ready'
                    : modelStatus === 'error'
                      ? 'Load failed'
                      : 'Preparing model'}
                </span>
              </div>
              <p className="panel-description">
                {modelStatus === 'ready'
                  ? 'The background remover is ready in your browser. Run it when your photo is in place.'
                  : 'The first run downloads the model into your browser cache. It usually takes longer once, then gets faster.'}
              </p>

              <div className="controls-grid background-remover-mode-grid">
                <div className="field field-full">
                  <span>Mode</span>
                  <div className="segmented-control" role="tablist" aria-label="Background removal mode">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={removalMode === 'photo'}
                      className={`segmented-control-button ${removalMode === 'photo' ? 'is-active' : ''}`}
                      onClick={() => handleRemovalModeChange('photo')}
                      disabled={isBusy}
                    >
                      Photo
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={removalMode === 'graphic'}
                      className={`segmented-control-button ${removalMode === 'graphic' ? 'is-active' : ''}`}
                      onClick={() => handleRemovalModeChange('graphic')}
                      disabled={isBusy}
                    >
                      Logo / Graphic
                    </button>
                  </div>
                  <p className="helper-text">
                    {removalMode === 'photo'
                      ? 'Photo mode works best for people, products, and everyday images.'
                      : 'Logo / Graphic mode is better for logos, screenshots, and clean flat designs.'}
                  </p>
                </div>
              </div>

              <details className="background-remover-advanced">
                <summary>Refine result</summary>
                <div className="controls-grid background-remover-refine-grid">
                  <label className="field">
                    <span>
                      Edge cleanup ({Math.round(refinementSettings.edgeCleanup * 100)}%)
                    </span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={Math.round(refinementSettings.edgeCleanup * 100)}
                      onChange={(event) =>
                        setRefinementSettings((current) => ({
                          ...current,
                          edgeCleanup: Number(event.target.value) / 100
                        }))
                      }
                      disabled={isBusy}
                    />
                  </label>
                  <label className="field">
                    <span>
                      Edge softness ({Math.round(refinementSettings.edgeSoftness * 100)}%)
                    </span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={Math.round(refinementSettings.edgeSoftness * 100)}
                      onChange={(event) =>
                        setRefinementSettings((current) => ({
                          ...current,
                          edgeSoftness: Number(event.target.value) / 100
                        }))
                      }
                      disabled={isBusy}
                    />
                  </label>
                  <label className="field field-full">
                    <span>
                      Threshold bias ({refinementSettings.thresholdBias >= 0 ? '+' : ''}
                      {refinementSettings.thresholdBias.toFixed(2)})
                    </span>
                    <input
                      type="range"
                      min="-40"
                      max="40"
                      step="1"
                      value={Math.round(refinementSettings.thresholdBias * 100)}
                      onChange={(event) =>
                        setRefinementSettings((current) => ({
                          ...current,
                          thresholdBias: Number(event.target.value) / 100
                        }))
                      }
                      disabled={isBusy}
                    />
                  </label>
                </div>
                <p className="helper-text">
                  Keep the defaults for most images. Increase cleanup for harder edges, or soften the
                  mask slightly for wispy photo details.
                </p>
              </details>

              {modelStatus !== 'ready' ? (
                <div className="background-remover-stage-card" aria-live="polite">
                  <p className="background-remover-stage-title">{modelStage}</p>
                  {modelProgress !== null ? (
                    <div className="background-remover-progress-track" aria-hidden="true">
                      <span
                        className="background-remover-progress-fill"
                        style={{ width: `${Math.round(modelProgress * 100)}%` }}
                      />
                    </div>
                  ) : null}
                  <div className="background-remover-loading-bars" aria-hidden="true">
                    <span className="background-remover-loading-bar" />
                    <span className="background-remover-loading-bar is-delay-1" />
                    <span className="background-remover-loading-bar is-delay-2" />
                  </div>
                  <p className="helper-text">
                    {modelProgress !== null
                      ? `${Math.round(modelProgress * 100)}% ready`
                      : 'Preparing browser runtime and model files'}
                  </p>
                  {modelStatus === 'error' ? (
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => setModelReloadToken((current) => current + 1)}
                    >
                      Retry Model Load
                    </button>
                  ) : null}
                </div>
              ) : (
                <div className="background-remover-ready-note">
                  <p className="helper-text">
                    Model ready. Run the cutout when your photo looks right.
                  </p>
                </div>
              )}

              {mayTakeLonger ? (
                <div className="tip-note background-remover-tip-note" role="note">
                  <span className="tip-note-icon" aria-hidden="true">
                    i
                  </span>
                  <p className="helper-text">
                    This photo is fairly large, so the first pass may take a bit longer on mobile or
                    lower-powered devices.
                  </p>
                </div>
              ) : null}

              <div className="export-action-row">
                <button
                  type="button"
                  className="primary-button"
                  onClick={handleRemoveBackground}
                  disabled={!canRunRemoval}
                >
                  {isBusy ? 'Removing Background...' : resultBlob ? 'Remove Again' : 'Remove Background'}
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setConfirmAction('clear')}
                  disabled={!imageAsset || isBusy}
                >
                  Choose Another Photo
                </button>
              </div>
            </section>
          </div>
        </div>

        <div className="right-column">
          <section className="panel preview-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Step 3</p>
                <h2>Review result</h2>
              </div>
              {imageAsset ? (
                <span className="dimension-badge">
                  {imageAsset.width} × {imageAsset.height}px
                </span>
              ) : null}
            </div>

            <div className="preview-compare-bar" aria-label="Preview comparison">
              <span className="preview-compare-label">View</span>
              <div className="preview-compare-toggle" role="tablist" aria-label="Preview comparison">
                <button
                  type="button"
                  role="tab"
                  aria-selected={previewMode === 'after'}
                  className={`preview-compare-button ${previewMode === 'after' ? 'is-active' : ''}`}
                  onClick={() => setPreviewMode('after')}
                  disabled={!resultBlob}
                >
                  Cutout
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={previewMode === 'before'}
                  className={`preview-compare-button ${previewMode === 'before' ? 'is-active' : ''}`}
                  onClick={() => setPreviewMode('before')}
                  disabled={!imageAsset}
                >
                  Original
                </button>
              </div>
            </div>

            <div className="preview-compare-bar background-remover-zoom-bar" aria-label="Preview zoom">
              <span className="preview-compare-label">Zoom</span>
              <div className="preview-compare-toggle" role="tablist" aria-label="Preview zoom">
                {[1, 2, 3].map((zoomLevel) => (
                  <button
                    key={zoomLevel}
                    type="button"
                    role="tab"
                    aria-selected={previewZoom === zoomLevel}
                    className={`preview-compare-button ${previewZoom === zoomLevel ? 'is-active' : ''}`}
                    onClick={() => setPreviewZoom(zoomLevel)}
                    disabled={!imageAsset}
                  >
                    {zoomLevel}x
                  </button>
                ))}
              </div>
            </div>

            <div className="preview-shell background-remover-preview-shell">
              {imageAsset ? (
                <div className="background-remover-preview-frame">
                  {isBusy && previewMode === 'after' ? (
                    <div className="background-remover-overlay-note">
                      <p>Processing cutout...</p>
                    </div>
                  ) : null}
                  <canvas
                    ref={previewCanvasRef}
                    className="preview-canvas"
                    style={{
                      transform: previewZoom === 1 ? 'none' : `scale(${previewZoom})`,
                      transformOrigin: 'top center'
                    }}
                    aria-label="Background remover preview"
                  />
                </div>
              ) : (
                <div className="preview-placeholder">
                  <p>Your cutout preview will appear here after you choose a photo.</p>
                </div>
              )}
            </div>
            <p className="helper-text section-helper-text">
              Transparent areas are shown on the checkerboard background so the cutout is easy to inspect.
            </p>
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Step 4</p>
                <h2>Download</h2>
              </div>
            </div>
            <p className="panel-description">
              Download a transparent PNG, or place the cutout on a simple solid background first.
            </p>
            <div className="controls-grid background-remover-export-grid">
              <div className="field field-full">
                <span>Background</span>
                <div className="segmented-control" role="tablist" aria-label="Background fill options">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={backgroundFillMode === 'transparent'}
                    className={`segmented-control-button ${
                      backgroundFillMode === 'transparent' ? 'is-active' : ''
                    }`}
                    onClick={() => setBackgroundFillMode('transparent')}
                    disabled={!resultBlob || isBusy}
                  >
                    Transparent
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={backgroundFillMode === 'white'}
                    className={`segmented-control-button ${
                      backgroundFillMode === 'white' ? 'is-active' : ''
                    }`}
                    onClick={() => setBackgroundFillMode('white')}
                    disabled={!resultBlob || isBusy}
                  >
                    White
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={backgroundFillMode === 'color'}
                    className={`segmented-control-button ${
                      backgroundFillMode === 'color' ? 'is-active' : ''
                    }`}
                    onClick={() => setBackgroundFillMode('color')}
                    disabled={!resultBlob || isBusy}
                  >
                    Color
                  </button>
                </div>
              </div>

              {backgroundFillMode === 'color' ? (
                <label className="field">
                  <span>Background color</span>
                  <input
                    type="color"
                    value={backgroundColor}
                    onChange={(event) => setBackgroundColor(event.target.value)}
                    disabled={!resultBlob || isBusy}
                  />
                </label>
              ) : null}
            </div>
            <div className="export-action-row">
              <button
                type="button"
                className="primary-button"
                onClick={handleDownload}
                disabled={!resultBlob || isBusy}
              >
                Download PNG
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setConfirmAction('clear')}
                disabled={!imageAsset || isBusy}
              >
                Choose Another Photo
              </button>
            </div>
            <canvas ref={exportCanvasRef} className="preview-canvas is-hidden" aria-hidden="true" />
          </section>
        </div>
      </section>

      <ConfirmModal
        open={confirmAction === 'clear'}
        title="Choose another photo?"
        message="This will clear the current background remover preview."
        confirmLabel="Choose Another Photo"
        cancelLabel="Keep Photo"
        onConfirm={handleChooseAnotherPhoto}
        onCancel={() => setConfirmAction(null)}
      />
    </>
  );
}
