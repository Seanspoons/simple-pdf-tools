import { RefObject } from 'react';

interface PreviewCanvasProps {
  canvasRef: RefObject<HTMLCanvasElement>;
  hasImage: boolean;
  beforeAfterMode: 'after' | 'before';
  dimensions?: { width: number; height: number };
  disabled?: boolean;
  onBeforeAfterChange: (mode: 'after' | 'before') => void;
}

export function PreviewCanvas({
  canvasRef,
  hasImage,
  beforeAfterMode,
  dimensions,
  disabled = false,
  onBeforeAfterChange
}: PreviewCanvasProps) {
  return (
    <section className="panel preview-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Step 2</p>
          <h2>Preview</h2>
        </div>
        {dimensions ? (
          <span className="dimension-badge">
            {dimensions.width} × {dimensions.height}px
          </span>
        ) : null}
      </div>

      <div className="preview-compare-bar" aria-label="Preview comparison">
        <span className="preview-compare-label">View</span>
        <div className="preview-compare-toggle" role="tablist" aria-label="Preview comparison">
          <button
            type="button"
            role="tab"
            aria-selected={beforeAfterMode === 'after'}
            className={`preview-compare-button ${beforeAfterMode === 'after' ? 'is-active' : ''}`}
            onClick={() => onBeforeAfterChange('after')}
            disabled={disabled || !hasImage}
          >
            Watermarked
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={beforeAfterMode === 'before'}
            className={`preview-compare-button ${beforeAfterMode === 'before' ? 'is-active' : ''}`}
            onClick={() => onBeforeAfterChange('before')}
            disabled={disabled || !hasImage}
          >
            Original
          </button>
        </div>
      </div>

      <div className="preview-shell watermark-preview-shell">
        {hasImage ? (
          <canvas
            ref={canvasRef}
            className="preview-canvas"
            aria-label={
              beforeAfterMode === 'before' ? 'Original photo preview' : 'Updated photo preview'
            }
          />
        ) : (
          <div className="preview-placeholder">
            <p>Your photo preview will appear here after you choose an image.</p>
          </div>
        )}
      </div>
    </section>
  );
}
