import { ChangeEvent, type CSSProperties, useId } from 'react';
import { FONT_OPTIONS } from '../constants';
import {
  SavedPreset,
  WatermarkLayout,
  WatermarkPosition,
  WatermarkProofAngle,
  WatermarkSettings
} from '../types';

interface WatermarkControlsProps {
  settings: WatermarkSettings;
  presetName: string;
  savedPresets: SavedPreset[];
  watermarkImageName?: string | null;
  hasWatermarkImage: boolean;
  disabled?: boolean;
  onSettingChange: <K extends keyof WatermarkSettings>(key: K, value: WatermarkSettings[K]) => void;
  onPresetNameChange: (value: string) => void;
  onSavePreset: () => void;
  onApplyPreset: (presetId: string) => void;
  onDeletePreset: (presetId: string) => void;
  onWatermarkImageSelect: (file: File) => void;
  onClearWatermarkImage: () => void;
  onReset: () => void;
}

const POSITION_OPTIONS: Array<{
  label: string;
  value: WatermarkPosition;
  iconClass: string;
  rotation?: string;
}> = [
  { label: 'Top left', value: 'top-left', iconClass: 'is-arrow', rotation: '-135deg' },
  { label: 'Top center', value: 'top-center', iconClass: 'is-arrow', rotation: '-90deg' },
  { label: 'Top right', value: 'top-right', iconClass: 'is-arrow', rotation: '-45deg' },
  { label: 'Center left', value: 'center-left', iconClass: 'is-arrow', rotation: '180deg' },
  { label: 'Center', value: 'center', iconClass: 'is-center' },
  { label: 'Center right', value: 'center-right', iconClass: 'is-arrow', rotation: '0deg' },
  { label: 'Bottom left', value: 'bottom-left', iconClass: 'is-arrow', rotation: '135deg' },
  { label: 'Bottom center', value: 'bottom-center', iconClass: 'is-arrow', rotation: '90deg' },
  { label: 'Bottom right', value: 'bottom-right', iconClass: 'is-arrow', rotation: '45deg' }
];

const LAYOUT_OPTIONS: Array<{ label: string; value: WatermarkLayout; description: string }> = [
  {
    label: 'Single mark',
    value: 'single',
    description: 'Place one watermark in a spot you choose.'
  },
  {
    label: 'Proof pattern',
    value: 'proof',
    description: 'Repeat the watermark across the photo for previews.'
  }
];

const PROOF_ANGLE_OPTIONS: Array<{ label: string; value: WatermarkProofAngle }> = [
  { label: 'Diagonal', value: 'diagonal' },
  { label: 'Reverse diagonal', value: 'reverse-diagonal' },
  { label: 'Straight', value: 'horizontal' }
];

function parseRangeValue(event: ChangeEvent<HTMLInputElement>): number {
  return Number(event.target.value);
}

function usesEdgeMargin(position: WatermarkPosition): boolean {
  return position !== 'center';
}

export function WatermarkControls({
  settings,
  presetName,
  savedPresets,
  watermarkImageName,
  hasWatermarkImage,
  disabled = false,
  onSettingChange,
  onPresetNameChange,
  onSavePreset,
  onApplyPreset,
  onDeletePreset,
  onWatermarkImageSelect,
  onClearWatermarkImage,
  onReset
}: WatermarkControlsProps) {
  const watermarkFileInputId = useId();

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Step 3</p>
          <h2>Make it your own</h2>
        </div>
        <button type="button" className="secondary-button" onClick={onReset} disabled={disabled}>
          Reset
        </button>
      </div>

      <div className="controls-grid">
        <div className="field field-full preset-panel">
          <span>Saved looks</span>
          <div className="preset-save-row">
            <input
              type="text"
              value={presetName}
              onChange={(event) => onPresetNameChange(event.target.value)}
              disabled={disabled}
              placeholder="Name this look"
            />
            <button type="button" className="secondary-button" onClick={onSavePreset} disabled={disabled}>
              Save look
            </button>
          </div>
          <div className="preset-list" aria-label="Saved looks">
            {savedPresets.length > 0 ? (
              savedPresets.map((preset) => (
                <div key={preset.id} className="preset-chip">
                  <button
                    type="button"
                    className="ghost-button preset-apply-button"
                    onClick={() => onApplyPreset(preset.id)}
                    disabled={disabled}
                  >
                    {preset.name}
                  </button>
                  <button
                    type="button"
                    className="preset-delete-button"
                    onClick={() => onDeletePreset(preset.id)}
                    disabled={disabled}
                    aria-label={`Delete look ${preset.name}`}
                  >
                    Remove
                  </button>
                </div>
              ))
            ) : (
              <p className="helper-text">No saved looks yet.</p>
            )}
          </div>
          <div className="tip-note" role="note">
            <span className="tip-note-icon" aria-hidden="true">
              i
            </span>
            <p className="helper-text">
              Saved looks keep your watermark style, layout, and position. If you use a logo on
              this device, it stays ready for your next photo too.
            </p>
          </div>
        </div>

        <fieldset className="field field-full layout-choice-group">
          <legend>Watermark type</legend>
          <div className="choice-cards">
            <button
              type="button"
              className={`choice-card ${settings.kind === 'text' ? 'is-active' : ''}`}
              onClick={() => onSettingChange('kind', 'text')}
              disabled={disabled}
            >
              <span className="watermark-choice-preview watermark-choice-preview-text" aria-hidden="true">
                Aa
              </span>
              <span className="choice-card-copy">
                <strong>Text watermark</strong>
                <span>Use your name, handle, or a short label.</span>
              </span>
            </button>
            <button
              type="button"
              className={`choice-card ${settings.kind === 'image' ? 'is-active' : ''}`}
              onClick={() => onSettingChange('kind', 'image')}
              disabled={disabled}
            >
              <span className="watermark-choice-preview watermark-choice-preview-image" aria-hidden="true">
                <span className="watermark-image-glyph">
                  <span className="watermark-image-glyph-badge" />
                  <span className="watermark-image-glyph-mark" />
                </span>
              </span>
              <span className="choice-card-copy">
                <strong>Logo or icon</strong>
                <span>Use a graphic mark instead of text.</span>
              </span>
            </button>
          </div>
        </fieldset>

        <fieldset className="field field-full layout-choice-group">
          <legend>Watermark style</legend>
          <div className="choice-cards">
            {LAYOUT_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`choice-card ${settings.layout === option.value ? 'is-active' : ''}`}
                onClick={() => onSettingChange('layout', option.value)}
                disabled={disabled}
              >
                <span
                  className={`watermark-choice-preview ${
                    option.value === 'single'
                      ? 'watermark-choice-preview-single'
                      : 'watermark-choice-preview-proof'
                  }`}
                  aria-hidden="true"
                >
                  {option.value === 'proof' ? <span className="watermark-proof-glyph-center" /> : null}
                </span>
                <span className="choice-card-copy">
                  <strong>{option.label}</strong>
                  <span>{option.description}</span>
                </span>
              </button>
            ))}
          </div>
        </fieldset>

        {settings.kind === 'text' ? (
          <>
            <label className="field field-full">
              <span>Watermark text</span>
              <input
                type="text"
                value={settings.text}
                onChange={(event) => onSettingChange('text', event.target.value)}
                disabled={disabled}
                placeholder="© Your Name"
              />
            </label>

            <label className="field">
              <span>Font</span>
              <select
                value={settings.fontFamily}
                onChange={(event) => onSettingChange('fontFamily', event.target.value)}
                disabled={disabled}
              >
                {FONT_OPTIONS.map((font) => (
                  <option key={font} value={font}>
                    {font}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Color</span>
              <input
                type="color"
                value={settings.color}
                onChange={(event) => onSettingChange('color', event.target.value)}
                disabled={disabled}
              />
            </label>
          </>
        ) : (
          <div className="field field-full">
            <span>Logo or icon</span>
            <div className="watermark-upload-card">
              <input
                id={watermarkFileInputId}
                className="sr-only"
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    onWatermarkImageSelect(file);
                  }
                  event.target.value = '';
                }}
                disabled={disabled}
              />
              <div className="watermark-upload-copy">
                <strong>{watermarkImageName ?? 'No logo chosen yet'}</strong>
                <span>PNG works best for a transparent logo or icon.</span>
              </div>
              <div className="watermark-upload-actions">
                <label htmlFor={watermarkFileInputId} className="secondary-button">
                  {hasWatermarkImage ? 'Choose another logo' : 'Choose logo'}
                </label>
                {hasWatermarkImage ? (
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={onClearWatermarkImage}
                    disabled={disabled}
                  >
                    Remove logo
                  </button>
                ) : null}
              </div>
            </div>
            {!hasWatermarkImage ? (
              <div className="tip-note" role="note">
                <span className="tip-note-icon" aria-hidden="true">
                  i
                </span>
                <p className="helper-text">
                  Switch to text anytime, or upload a small logo file to use an image watermark.
                </p>
              </div>
            ) : null}
          </div>
        )}

        {settings.layout === 'single' ? (
          <>
            <fieldset className="field field-full layout-choice-group">
              <legend>Position</legend>
              <div className="position-grid" role="radiogroup" aria-label="Watermark position">
                {POSITION_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`position-button ${
                      settings.position === option.value ? 'is-active' : ''
                    }`}
                    onClick={() => onSettingChange('position', option.value)}
                    disabled={disabled}
                    aria-pressed={settings.position === option.value}
                  >
                    <span
                      className={`position-button-icon ${option.iconClass}`}
                      style={
                        option.rotation
                          ? ({ '--arrow-rotation': option.rotation } as CSSProperties)
                          : undefined
                      }
                      aria-hidden="true"
                    />
                    <span className="sr-only">{option.label}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            {usesEdgeMargin(settings.position) ? (
              <label className="field">
                <span>Distance from edge ({settings.margin}%)</span>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="0.5"
                  value={settings.margin}
                  onChange={(event) => onSettingChange('margin', parseRangeValue(event))}
                  disabled={disabled}
                />
              </label>
            ) : null}
          </>
        ) : (
          <>
            <label className="field">
              <span>Pattern spacing ({settings.proofGap}%)</span>
              <input
                type="range"
                min="8"
                max="40"
                step="1"
                value={settings.proofGap}
                onChange={(event) => onSettingChange('proofGap', parseRangeValue(event))}
                disabled={disabled}
              />
            </label>

            <label className="field">
              <span>Pattern angle</span>
              <select
                value={settings.proofAngle}
                onChange={(event) =>
                  onSettingChange('proofAngle', event.target.value as WatermarkProofAngle)
                }
                disabled={disabled}
              >
                {PROOF_ANGLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}

        <label className="field">
          <span>Opacity ({Math.round(settings.opacity * 100)}%)</span>
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.05"
            value={settings.opacity}
            onChange={(event) => onSettingChange('opacity', parseRangeValue(event))}
            disabled={disabled}
          />
        </label>

        <label className="field">
          <span>Size ({settings.size}%)</span>
          <input
            type="range"
            min="1"
            max="14"
            step="0.5"
            value={settings.size}
            onChange={(event) => onSettingChange('size', parseRangeValue(event))}
            disabled={disabled}
          />
        </label>

        <fieldset className="toggle-row field-full">
          <legend>{settings.kind === 'text' ? 'Text style' : 'Image style'}</legend>
          {settings.kind === 'text' ? (
            <label className="check-field">
              <input
                type="checkbox"
                checked={settings.bold}
                onChange={(event) => onSettingChange('bold', event.target.checked)}
                disabled={disabled}
              />
              <span>Bold</span>
            </label>
          ) : null}
          <label className="check-field">
            <input
              type="checkbox"
              checked={settings.shadow}
              onChange={(event) => onSettingChange('shadow', event.target.checked)}
              disabled={disabled}
            />
            <span>Shadow</span>
          </label>
          {settings.kind === 'text' ? (
            <label className="check-field">
              <input
                type="checkbox"
                checked={settings.showBackground}
                onChange={(event) => onSettingChange('showBackground', event.target.checked)}
                disabled={disabled}
              />
              <span>Soft background</span>
            </label>
          ) : null}
        </fieldset>

      </div>
    </section>
  );
}
