import { useEffect, useMemo, useRef, useState } from 'react';
import { ConfirmModal } from '../ConfirmModal';
import { FloatingMessage } from '../FloatingMessage';
import { PreviewCanvas } from '../PreviewCanvas';
import { UploadPanel } from '../UploadPanel';
import { WatermarkControls } from '../WatermarkControls';
import {
  DEFAULT_SETTINGS,
  EXPORT_FORMAT_STORAGE_KEY,
  PRESETS_STORAGE_KEY,
  SETTINGS_STORAGE_KEY
} from '../../constants';
import {
  createDownloadFilename,
  exportCanvasToBlob,
  shareImageIfPossible,
  triggerDownload
} from '../../utils/exportImage';
import { loadImageAsset } from '../../utils/imageLoader';
import { renderWatermarkedImage } from '../../utils/renderWatermark';
import {
  clearWatermarkDraft,
  clearWatermarkLogo,
  loadWatermarkDraft,
  loadWatermarkLogo,
  saveWatermarkLogo,
  saveWatermarkDraft
} from '../../utils/watermark/draftStorage';
import { ExportFormat, ImageAsset, SavedPreset, WatermarkSettings } from '../../types';

type WatermarkConfirmAction = 'clear' | 'reset' | null;

function normalizeWatermarkSettings(
  settings: Partial<WatermarkSettings> | WatermarkSettings
): WatermarkSettings {
  return { ...DEFAULT_SETTINGS, ...settings };
}

function loadStoredSettings(): WatermarkSettings {
  if (typeof window === 'undefined') {
    return DEFAULT_SETTINGS;
  }

  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_SETTINGS;
    }

    return normalizeWatermarkSettings(JSON.parse(raw) as Partial<WatermarkSettings>);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function getPreviewSize(width: number, height: number): { width: number; height: number } {
  const maxWidth = 960;
  const maxHeight = 720;
  const scale = Math.min(maxWidth / width, maxHeight / height, 1);
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale)
  };
}

function loadStoredExportFormat(): ExportFormat {
  if (typeof window === 'undefined') {
    return 'jpeg';
  }

  const raw = window.localStorage.getItem(EXPORT_FORMAT_STORAGE_KEY);
  return raw === 'png' ? 'png' : 'jpeg';
}

function loadStoredPresets(): SavedPreset[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(PRESETS_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    return (JSON.parse(raw) as SavedPreset[]).map((preset) => ({
      ...preset,
      settings: normalizeWatermarkSettings(preset.settings)
    }));
  } catch {
    return [];
  }
}

export function WatermarkTool() {
  const [imageAsset, setImageAsset] = useState<ImageAsset | null>(null);
  const [watermarkAsset, setWatermarkAsset] = useState<ImageAsset | null>(null);
  const [settings, setSettings] = useState<WatermarkSettings>(loadStoredSettings);
  const [exportFormat, setExportFormat] = useState<ExportFormat>(loadStoredExportFormat);
  const [savedPresets, setSavedPresets] = useState<SavedPreset[]>(loadStoredPresets);
  const [presetName, setPresetName] = useState('');
  const [previewMode, setPreviewMode] = useState<'after' | 'before'>('after');
  const [isBusy, setIsBusy] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [hasLoadedDraft, setHasLoadedDraft] = useState(false);
  const [confirmAction, setConfirmAction] = useState<WatermarkConfirmAction>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const exportCanvasRef = useRef<HTMLCanvasElement>(null);
  const exportPreviewCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    setCanNativeShare('share' in navigator && 'canShare' in navigator);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    window.localStorage.setItem(EXPORT_FORMAT_STORAGE_KEY, exportFormat);
  }, [exportFormat]);

  useEffect(() => {
    window.localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(savedPresets));
  }, [savedPresets]);

  useEffect(() => {
    let isCancelled = false;

    async function restoreDraft() {
      try {
        const draft = await loadWatermarkDraft();
        const standaloneLogoFile = draft?.watermarkFile ?? (await loadWatermarkLogo());
        if (!draft || isCancelled) {
          if (!isCancelled && standaloneLogoFile) {
            const restoredWatermarkAsset = await loadImageAsset(standaloneLogoFile);
            setWatermarkAsset((current) => {
              if (current?.objectUrl) {
                URL.revokeObjectURL(current.objectUrl);
              }
              return restoredWatermarkAsset;
            });
          }
          setHasLoadedDraft(true);
          return;
        }

        const restoredAsset = draft.file ? await loadImageAsset(draft.file) : null;
        const restoredWatermarkAsset = standaloneLogoFile
          ? await loadImageAsset(standaloneLogoFile)
          : null;
        if (isCancelled) {
          if (restoredAsset) {
            URL.revokeObjectURL(restoredAsset.objectUrl);
          }
          if (restoredWatermarkAsset) {
            URL.revokeObjectURL(restoredWatermarkAsset.objectUrl);
          }
          return;
        }

        setSettings(normalizeWatermarkSettings(draft.settings));
        setExportFormat(draft.exportFormat);
        setPreviewMode(draft.previewMode);
        setImageAsset((current) => {
          if (current?.objectUrl) {
            URL.revokeObjectURL(current.objectUrl);
          }
          return restoredAsset;
        });
        setWatermarkAsset((current) => {
          if (current?.objectUrl) {
            URL.revokeObjectURL(current.objectUrl);
          }
          return restoredWatermarkAsset;
        });
        setStatusMessage(restoredAsset ? 'Restored your last watermark.' : null);
      } catch {
        if (!isCancelled) {
          setErrorMessage('Your last watermark could not be restored.');
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
    if (!imageAsset || !previewCanvasRef.current) {
      return;
    }

    const previewCanvas = previewCanvasRef.current;
    const previewSize = getPreviewSize(imageAsset.width, imageAsset.height);
    if (previewMode === 'before') {
      previewCanvas.width = previewSize.width;
      previewCanvas.height = previewSize.height;
      const context = previewCanvas.getContext('2d');
      if (!context) {
        return;
      }

      context.clearRect(0, 0, previewSize.width, previewSize.height);
      context.drawImage(imageAsset.image, 0, 0, previewSize.width, previewSize.height);
      return;
    }

    renderWatermarkedImage({
      canvas: previewCanvas,
      image: imageAsset.image,
      watermarkImage: watermarkAsset?.image,
      width: previewSize.width,
      height: previewSize.height,
      settings
    });
  }, [imageAsset, previewMode, settings, watermarkAsset]);

  useEffect(() => {
    if (!imageAsset || !exportPreviewCanvasRef.current) {
      return;
    }

    const exportPreviewCanvas = exportPreviewCanvasRef.current;
    const previewSize = getPreviewSize(imageAsset.width, imageAsset.height);

    renderWatermarkedImage({
      canvas: exportPreviewCanvas,
      image: imageAsset.image,
      watermarkImage: watermarkAsset?.image,
      width: previewSize.width,
      height: previewSize.height,
      settings
    });
  }, [imageAsset, settings, watermarkAsset]);

  useEffect(() => {
    return () => {
      if (imageAsset?.objectUrl) {
        URL.revokeObjectURL(imageAsset.objectUrl);
      }
      if (watermarkAsset?.objectUrl) {
        URL.revokeObjectURL(watermarkAsset.objectUrl);
      }
    };
  }, [imageAsset, watermarkAsset]);

  useEffect(() => {
    if (!hasLoadedDraft) {
      return;
    }

    void saveWatermarkDraft(
      settings,
      exportFormat,
      previewMode,
      imageAsset?.file ?? null,
      watermarkAsset?.file ?? null
    );
  }, [exportFormat, hasLoadedDraft, imageAsset, previewMode, settings, watermarkAsset]);

  const imageSummary = useMemo(() => {
    if (!imageAsset) {
      return 'Choose a photo to get started.';
    }

    return `${imageAsset.name} • ${imageAsset.width} × ${imageAsset.height}px`;
  }, [imageAsset]);

  const handleFileSelect = async (file: File) => {
    setIsBusy(true);
    setErrorMessage(null);
    setStatusMessage('Opening photo...');

    try {
      const nextAsset = await loadImageAsset(file);
      setImageAsset((current) => {
        if (current?.objectUrl) {
          URL.revokeObjectURL(current.objectUrl);
        }

        return nextAsset;
      });
      setPreviewMode('after');
      setStatusMessage('Photo ready.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'The photo could not be loaded.');
      setStatusMessage(null);
    } finally {
      setIsBusy(false);
    }
  };

  const handleWatermarkFileSelect = async (file: File) => {
    setIsBusy(true);
    setErrorMessage(null);
    setStatusMessage('Opening watermark image...');

    try {
      const nextAsset = await loadImageAsset(file);
      await saveWatermarkLogo(file);
      setWatermarkAsset((current) => {
        if (current?.objectUrl) {
          URL.revokeObjectURL(current.objectUrl);
        }

        return nextAsset;
      });
      setSettings((current) => ({ ...current, kind: 'image' }));
      setStatusMessage('Watermark image ready.');
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'The watermark image could not be loaded.'
      );
      setStatusMessage(null);
    } finally {
      setIsBusy(false);
    }
  };

  const handleSettingChange = <K extends keyof WatermarkSettings>(
    key: K,
    value: WatermarkSettings[K]
  ) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
    setExportFormat('jpeg');
    setPreviewMode('after');
    setStatusMessage('Settings reset.');
  };

  const handleSavePreset = () => {
    const trimmedName = presetName.trim();
    if (!trimmedName) {
      setErrorMessage('Add a name before saving this look.');
      return;
    }

    const nextPreset: SavedPreset = {
      id: `preset-${Date.now()}`,
      name: trimmedName,
      settings,
      exportFormat
    };

    setSavedPresets((current) => [...current, nextPreset]);
    setPresetName('');
    setErrorMessage(null);
    setStatusMessage(`Saved "${trimmedName}".`);
  };

  const handleApplyPreset = (presetId: string) => {
    const preset = savedPresets.find((entry) => entry.id === presetId);
    if (!preset) {
      return;
    }

    setSettings(normalizeWatermarkSettings(preset.settings));
    setExportFormat(preset.exportFormat);
    setErrorMessage(null);
    setStatusMessage(`Applied "${preset.name}".`);
  };

  const handleDeletePreset = (presetId: string) => {
    const preset = savedPresets.find((entry) => entry.id === presetId);
    if (!preset) {
      return;
    }

    setSavedPresets((current) => current.filter((entry) => entry.id !== presetId));
    setErrorMessage(null);
    setStatusMessage(`Removed "${preset.name}".`);
  };

  const handleChooseAnotherPhoto = () => {
    setImageAsset((current) => {
      if (current?.objectUrl) {
        URL.revokeObjectURL(current.objectUrl);
      }

      return null;
    });
    setPreviewMode('after');
    void clearWatermarkDraft();
    setErrorMessage(null);
    setStatusMessage('Ready for another photo.');
    setConfirmAction(null);
  };

  const handleClearWatermarkImage = () => {
    void clearWatermarkLogo();
    setWatermarkAsset((current) => {
      if (current?.objectUrl) {
        URL.revokeObjectURL(current.objectUrl);
      }

      return null;
    });
    setErrorMessage(null);
    setStatusMessage('Logo watermark removed.');
  };

  const handleConfirmReset = () => {
    handleReset();
    setConfirmAction(null);
  };

  const runExport = async (format: ExportFormat, action: 'download' | 'share') => {
    if (!imageAsset || !exportCanvasRef.current) {
      setErrorMessage('Choose a photo before saving.');
      return;
    }

    if (settings.kind === 'image' && !watermarkAsset) {
      setErrorMessage('Choose a logo or icon before saving this watermark.');
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);
    setStatusMessage(
      action === 'share' ? 'Getting your photo ready to share...' : 'Getting your photo ready...'
    );

    try {
      renderWatermarkedImage({
        canvas: exportCanvasRef.current,
        image: imageAsset.image,
        watermarkImage: watermarkAsset?.image,
        width: imageAsset.width,
        height: imageAsset.height,
        settings
      });

      const blob = await exportCanvasToBlob(exportCanvasRef.current, format, 0.94);
      const filename = createDownloadFilename(imageAsset.name, format);

      if (action === 'share') {
        const shared = await shareImageIfPossible(blob, filename);
        if (!shared) {
          triggerDownload(blob, filename);
          setStatusMessage('Sharing is not available here, so your photo was downloaded instead.');
          return;
        }

        setStatusMessage('Shared successfully.');
        return;
      }

      triggerDownload(blob, filename);
      setStatusMessage(`${filename} is ready.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'The image could not be exported.');
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
            <p className="eyebrow">Photo Watermarker</p>
            <h1>Quick photo watermarking that feels simple.</h1>
            <p className="hero-copy">
              Pick a photo, add your wording, preview the look, and save the finished image in
              just a couple of taps.
            </p>
            <div className="hero-tags" aria-label="Supported image types">
              <span className="hero-tag">JPEG</span>
              <span className="hero-tag">PNG</span>
              <span className="hero-tag">WebP</span>
              <span className="hero-tag">HEIC</span>
              <span className="hero-tag">HEIF</span>
            </div>
          </div>
        </div>
        <div className="hero-card">
          <p className="hero-stat-label">Selected photo</p>
          <p className="hero-stat">{imageSummary}</p>
          <div className="tip-note" role="note">
            <span className="tip-note-icon" aria-hidden="true">
              i
            </span>
            <p className="helper-text">
              Your photo stays on this device. Save a favorite look once and use it again anytime.
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

      <section className="layout-grid watermark-layout-grid">
        <div className="left-column">
          <UploadPanel onFileSelect={handleFileSelect} disabled={isBusy} fileName={imageAsset?.name} />
          <div className="preview-sticky-wrap">
            <PreviewCanvas
              canvasRef={previewCanvasRef}
              hasImage={Boolean(imageAsset)}
              beforeAfterMode={previewMode}
              dimensions={imageAsset ? { width: imageAsset.width, height: imageAsset.height } : undefined}
              disabled={isBusy}
              onBeforeAfterChange={setPreviewMode}
            />
          </div>
        </div>

        <div className="right-column">
          <WatermarkControls
            settings={settings}
            presetName={presetName}
            savedPresets={savedPresets}
            watermarkImageName={watermarkAsset?.name ?? null}
            hasWatermarkImage={Boolean(watermarkAsset)}
            disabled={isBusy}
            onSettingChange={handleSettingChange}
            onPresetNameChange={setPresetName}
            onSavePreset={handleSavePreset}
            onApplyPreset={handleApplyPreset}
            onDeletePreset={handleDeletePreset}
            onWatermarkImageSelect={handleWatermarkFileSelect}
            onClearWatermarkImage={handleClearWatermarkImage}
            onReset={() => setConfirmAction('reset')}
          />

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
                    aria-label="Final watermarked preview"
                  />
                </div>
                <div className="tip-note panel-description panel-description-tight" role="note">
                  <span className="tip-note-icon" aria-hidden="true">
                    i
                  </span>
                  <p className="helper-text">
                    This is the clean saved version without the compare toggle.
                  </p>
                </div>
              </div>
            ) : null}

            <div className="export-actions">
              <button
                type="button"
                className="primary-button"
                onClick={() => runExport('jpeg', 'download')}
                disabled={!imageAsset || isBusy}
              >
                Save JPEG
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => runExport('png', 'download')}
                disabled={!imageAsset || isBusy}
              >
                Save PNG
              </button>
              {canNativeShare ? (
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => runExport('jpeg', 'share')}
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
                Start a New Watermark
              </button>
            </div>

            <div className="tip-note panel-description panel-description-tight" role="note">
              <span className="tip-note-icon" aria-hidden="true">
                i
              </span>
              <p className="helper-text">Saved photos keep the original image size.</p>
            </div>
          </section>
        </div>
      </section>

      <canvas ref={exportCanvasRef} className="sr-only" aria-hidden="true" />
      <ConfirmModal
        open={confirmAction !== null}
        title={confirmAction === 'reset' ? 'Reset this watermark?' : 'Start a new watermark?'}
        message={
          confirmAction === 'reset'
            ? 'This will reset your current watermark settings back to the defaults. Your photo and saved looks will stay.'
            : 'This will remove the current photo and preview. Your saved looks and current text settings will stay.'
        }
        confirmLabel={confirmAction === 'reset' ? 'Reset Watermark' : 'Start New Watermark'}
        onConfirm={confirmAction === 'reset' ? handleConfirmReset : handleChooseAnotherPhoto}
        onCancel={() => setConfirmAction(null)}
      />
    </>
  );
}
