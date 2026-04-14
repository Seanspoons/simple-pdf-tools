import { MAX_COLLAGE_COLUMNS } from '../../constants';
import {
  CollageQualityPreset,
  CollageSavedPreset,
  CollageSettings,
  CollageShapePreset
} from '../../types';

const SHAPE_OPTIONS: Array<{
  value: CollageShapePreset;
  label: string;
  description: string;
  previewClassName: string;
}> = [
  {
    value: 'square',
    label: 'Square',
    description: '1:1',
    previewClassName: 'output-preview-square'
  },
  {
    value: 'portrait',
    label: 'Portrait',
    description: '4:5',
    previewClassName: 'output-preview-portrait'
  },
  {
    value: 'story',
    label: 'Story',
    description: '9:16',
    previewClassName: 'output-preview-story'
  }
];

const QUALITY_OPTIONS: Array<{
  value: CollageQualityPreset;
  label: string;
  description: string;
}> = [
  { value: 'standard', label: 'Standard', description: '1x size' },
  { value: 'hd', label: 'HD', description: '2x size' },
  { value: 'uhd', label: 'UHD', description: '3x size' }
];

interface CollageControlsProps {
  settings: CollageSettings;
  presetName: string;
  savedPresets: CollageSavedPreset[];
  canUndo: boolean;
  canRedo: boolean;
  layoutWarning: string | null;
  warningActions: Array<{ label: string; onClick: () => void }>;
  disabled?: boolean;
  onPresetNameChange: (value: string) => void;
  onSavePreset: () => void;
  onApplyPreset: (presetId: string) => void;
  onDeletePreset: (presetId: string) => void;
  onAutoArrange: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onChange: <K extends keyof CollageSettings>(key: K, value: CollageSettings[K]) => void;
  onReset: () => void;
}

export function CollageControls({
  settings,
  presetName,
  savedPresets,
  canUndo,
  canRedo,
  layoutWarning,
  warningActions,
  disabled = false,
  onPresetNameChange,
  onSavePreset,
  onApplyPreset,
  onDeletePreset,
  onAutoArrange,
  onUndo,
  onRedo,
  onChange,
  onReset
}: CollageControlsProps) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Step 2</p>
          <h2>Choose the look</h2>
        </div>
        <div className="panel-heading-actions">
          <button type="button" className="ghost-button" onClick={onUndo} disabled={disabled || !canUndo}>
            Undo
          </button>
          <button type="button" className="ghost-button" onClick={onRedo} disabled={disabled || !canRedo}>
            Redo
          </button>
          <button type="button" className="ghost-button" onClick={onAutoArrange} disabled={disabled}>
            Auto arrange
          </button>
          <button type="button" className="secondary-button" onClick={onReset} disabled={disabled}>
            Reset
          </button>
        </div>
      </div>

      <div className="controls-grid">
        <div className="field field-full preset-panel">
          <span>Saved collage looks</span>
          <div className="preset-save-row">
            <input
              type="text"
              value={presetName}
              onChange={(event) => onPresetNameChange(event.target.value)}
              disabled={disabled}
              placeholder="Name this collage look"
            />
            <button type="button" className="secondary-button" onClick={onSavePreset} disabled={disabled}>
              Save look
            </button>
          </div>
          <div className="preset-list" aria-label="Saved collage looks">
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
                    aria-label={`Delete collage look ${preset.name}`}
                  >
                    Remove
                  </button>
                </div>
              ))
            ) : (
              <p className="helper-text">No saved collage looks yet.</p>
            )}
          </div>
          <div className="tip-note" role="note">
            <span className="tip-note-icon" aria-hidden="true">
              i
            </span>
            <p className="helper-text">
              Each saved look keeps your collage size, spacing, background, and tile settings.
            </p>
          </div>
        </div>

        <div className="field field-full collage-summary">
          <span>Quick summary</span>
          <p className="helper-text">
            {settings.columns} columns with {settings.gap}px spacing keeps{' '}
            {settings.fitMode === 'cover' ? 'photos filled edge to edge' : 'full photos visible'}.
          </p>
        </div>

        {layoutWarning ? (
          <div className="field field-full collage-warning" role="status">
            <span>Heads up</span>
            <p className="helper-text">{layoutWarning}</p>
            {warningActions.length > 0 ? (
              <div className="warning-actions">
                {warningActions.map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    className="ghost-button warning-action-button"
                    onClick={action.onClick}
                    disabled={disabled}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <fieldset className="field field-full layout-choice-group">
          <legend>Shape</legend>
          <div className="output-choice-grid">
            {SHAPE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`output-choice-card ${
                  settings.shapePreset === option.value ? 'is-active' : ''
                }`}
                onClick={() => onChange('shapePreset', option.value)}
                disabled={disabled}
              >
                <span className={`output-preview ${option.previewClassName}`} aria-hidden="true" />
                <span className="choice-card-copy">
                  <strong>{option.label}</strong>
                  <span>{option.description}</span>
                </span>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="field field-full layout-choice-group">
          <legend>Quality</legend>
          <div className="output-choice-grid quality-choice-grid">
            {QUALITY_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`output-choice-card ${
                  settings.qualityPreset === option.value ? 'is-active' : ''
                }`}
                onClick={() => onChange('qualityPreset', option.value)}
                disabled={disabled}
              >
                <span className="choice-card-copy">
                  <strong>{option.label}</strong>
                  <span>{option.description}</span>
                </span>
              </button>
            ))}
          </div>
        </fieldset>

        <label className="field">
          <span>Columns ({settings.columns})</span>
          <input
            type="range"
            min="2"
            max={String(MAX_COLLAGE_COLUMNS)}
            step="1"
            value={settings.columns}
            onChange={(event) => onChange('columns', Number(event.target.value))}
            disabled={disabled}
          />
        </label>

        <label className="field">
          <span>Spacing ({settings.gap}px)</span>
          <input
            type="range"
            min="0"
            max="32"
            step="2"
            value={settings.gap}
            onChange={(event) => onChange('gap', Number(event.target.value))}
            disabled={disabled}
          />
        </label>

        <label className="field">
          <span>Background</span>
          <input
            type="color"
            value={settings.backgroundColor}
            onChange={(event) => onChange('backgroundColor', event.target.value)}
            disabled={disabled}
          />
        </label>

        <label className="field">
          <span>Photo fit</span>
          <select
            value={settings.fitMode}
            onChange={(event) => onChange('fitMode', event.target.value as CollageSettings['fitMode'])}
            disabled={disabled}
          >
            <option value="cover">Fill the tiles</option>
            <option value="contain">Keep full photo</option>
          </select>
        </label>

        <label className="field">
          <span>Corner rounding ({settings.cornerRadius}px)</span>
          <input
            type="range"
            min="0"
            max="36"
            step="2"
            value={settings.cornerRadius}
            onChange={(event) => onChange('cornerRadius', Number(event.target.value))}
            disabled={disabled}
          />
        </label>

      </div>
    </section>
  );
}
