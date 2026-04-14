import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from 'react';
import { ConfirmModal } from '../ConfirmModal';
import { FloatingMessage } from '../FloatingMessage';
import { triggerDownload } from '../../utils/exportImage';

type MergeItem = {
  id: string;
  file: File;
};

type ConfirmAction = 'clear' | null;

function createId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `pdf-${Date.now()}-${Math.random().toString(16).slice(2)}`;
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

function createMergedFilename(files: MergeItem[]) {
  const baseName = files[0]?.file.name.replace(/\.pdf$/i, '') || 'merged-pdf';
  return `${baseName}-merged.pdf`;
}

export function MergePdfTool() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<MergeItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const totalSize = useMemo(
    () => files.reduce((sum, item) => sum + item.file.size, 0),
    [files]
  );

  const mergeSummary = useMemo(() => {
    if (files.length === 0) {
      return 'Choose PDF files to get started.';
    }

    return `${files.length} file${files.length === 1 ? '' : 's'} • ${formatBytes(totalSize)}`;
  }, [files, totalSize]);

  useEffect(() => {
    return () => {
      setFiles([]);
    };
  }, []);

  function appendFiles(incoming: FileList | null) {
    if (!incoming) {
      return;
    }

    const validFiles: MergeItem[] = [];
    const invalidFiles: string[] = [];

    Array.from(incoming).forEach((file) => {
      const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
      if (!isPdf) {
        invalidFiles.push(file.name);
        return;
      }

      validFiles.push({
        id: createId(),
        file
      });
    });

    if (validFiles.length > 0) {
      setFiles((current) => [...current, ...validFiles]);
      setStatusMessage(
        validFiles.length === 1
          ? `${validFiles[0].file.name} is ready to merge.`
          : `${validFiles.length} PDF files are ready to merge.`
      );
      setErrorMessage(null);
    }

    if (invalidFiles.length > 0) {
      setErrorMessage(`Only PDF files are supported. Skipped: ${invalidFiles.join(', ')}`);
    }
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    appendFiles(event.target.files);
    event.target.value = '';
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
    appendFiles(event.dataTransfer.files);
  }

  function moveFile(index: number, direction: -1 | 1) {
    setFiles((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }

      const next = [...current];
      const [moved] = next.splice(index, 1);
      next.splice(nextIndex, 0, moved);
      return next;
    });
  }

  function removeFile(id: string) {
    setFiles((current) => current.filter((item) => item.id !== id));
    setStatusMessage('Updated the merge order.');
  }

  async function runMerge() {
    if (files.length < 2) {
      setErrorMessage('Choose at least two PDF files before merging.');
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);
    setStatusMessage('Merging PDF files...');

    try {
      const { PDFDocument } = await import('pdf-lib');
      const mergedPdf = await PDFDocument.create();

      for (const item of files) {
        const sourceBytes = await item.file.arrayBuffer();
        const sourcePdf = await PDFDocument.load(sourceBytes);
        const copiedPages = await mergedPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));
      }

      const mergedBytes = await mergedPdf.save();
      const blob = new Blob([mergedBytes.slice().buffer], { type: 'application/pdf' });
      const filename = createMergedFilename(files);

      triggerDownload(blob, filename);
      setStatusMessage(`${filename} is ready.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'The PDF files could not be merged.');
      setStatusMessage(null);
    } finally {
      setIsBusy(false);
    }
  }

  function handleStartNewMerge() {
    setConfirmAction(null);
    setFiles([]);
    setStatusMessage('Ready for another merge.');
    setErrorMessage(null);
  }

  return (
    <>
      <section className="hero">
        <div className="hero-copy-block">
          <div>
            <p className="eyebrow">Merge PDF</p>
            <h1>Combine PDF files without leaving your browser.</h1>
            <p className="hero-copy">
              Add multiple PDF files, set the reading order, and download one merged document with
              the same clean step-by-step workflow as the other tools.
            </p>
            <div className="hero-tags" aria-label="Merge PDF highlights">
              <span className="hero-tag">Multiple PDF files</span>
              <span className="hero-tag">Reorder before export</span>
              <span className="hero-tag">Private in browser</span>
            </div>
          </div>
        </div>
        <div className="hero-card">
          <p className="hero-stat-label">Your merge</p>
          <p className="hero-stat">{mergeSummary}</p>
          <div className="tip-note" role="note">
            <span className="tip-note-icon" aria-hidden="true">
              i
            </span>
            <p className="helper-text">
              Merge PDF keeps your files in the browser and combines them in the order you choose.
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
          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Step 1</p>
                <h2>Choose your PDF files</h2>
              </div>
              {files.length > 0 ? (
                <span className="file-badge">
                  {files.length} file{files.length === 1 ? '' : 's'}
                </span>
              ) : null}
            </div>

            <label
              className={`upload-dropzone ${isDragging ? 'is-dragging' : ''} ${isBusy ? 'is-disabled' : ''}`}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              <input
                ref={inputRef}
                className="sr-only"
                type="file"
                accept="application/pdf,.pdf"
                multiple
                onChange={handleInputChange}
                disabled={isBusy}
              />
              <span className="upload-title">Choose PDF Files</span>
              <span className="upload-copy">
                Pick PDF files from your device. You can also drag and drop on desktop.
              </span>
            </label>
          </section>

          <div className="preview-sticky-wrap">
            <section className="panel preview-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Preview</p>
                  <h2>Your merge order</h2>
                </div>
                {files.length > 0 ? <span className="dimension-badge">{formatBytes(totalSize)}</span> : null}
              </div>

              {files.length > 0 ? (
                <div className="merge-preview-list">
                  {files.map((item, index) => (
                    <article key={item.id} className="merge-preview-card">
                      <div className="merge-preview-order">{index + 1}</div>
                      <div className="merge-preview-copy">
                        <p className="merge-preview-name">{item.file.name}</p>
                        <p className="helper-text">{formatBytes(item.file.size)}</p>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="preview-placeholder">
                  <p>Your PDFs will appear here after you choose files.</p>
                </div>
              )}
            </section>
          </div>
        </div>

        <div className="right-column">
          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Step 2</p>
                <h2>Arrange the order</h2>
              </div>
            </div>

            {files.length > 0 ? (
              <div className="merge-arrange-list">
                {files.map((item, index) => (
                  <article key={item.id} className="merge-arrange-card">
                    <div className="merge-arrange-copy">
                      <p className="merge-preview-name">{item.file.name}</p>
                      <p className="helper-text">
                        Position {index + 1} of {files.length}
                      </p>
                    </div>
                    <div className="merge-arrange-actions">
                      <button
                        type="button"
                        className="secondary-button merge-order-button"
                        onClick={() => moveFile(index, -1)}
                        disabled={index === 0 || isBusy}
                      >
                        Move Up
                      </button>
                      <button
                        type="button"
                        className="secondary-button merge-order-button"
                        onClick={() => moveFile(index, 1)}
                        disabled={index === files.length - 1 || isBusy}
                      >
                        Move Down
                      </button>
                      <button
                        type="button"
                        className="ghost-button is-danger"
                        onClick={() => removeFile(item.id)}
                        disabled={isBusy}
                      >
                        Remove
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="helper-text">Add PDF files first, then reorder them here before exporting.</p>
            )}
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Step 3</p>
                <h2>Review result</h2>
              </div>
            </div>

            {files.length > 0 ? (
              <div className="export-preview-block">
                <p className="helper-text export-preview-label">Export summary</p>
                <div className="export-preview-shell merge-export-shell">
                  <div className="merge-export-summary">
                    <p className="merge-export-summary-title">{createMergedFilename(files)}</p>
                    <p className="helper-text">
                      {files.length} file{files.length === 1 ? '' : 's'} will be merged into one PDF.
                    </p>
                    <p className="helper-text">Source size before merge: {formatBytes(totalSize)}</p>
                  </div>
                </div>
                <div className="tip-note panel-description panel-description-tight" role="note">
                  <span className="tip-note-icon" aria-hidden="true">
                    i
                  </span>
                  <p className="helper-text">
                    The final PDF keeps the pages from each file in the order shown above.
                  </p>
                </div>
              </div>
            ) : null}

            <div className="export-actions">
              <button
                type="button"
                className="primary-button"
                onClick={runMerge}
                disabled={files.length < 2 || isBusy}
              >
                Export Merged PDF
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={() => setConfirmAction('clear')}
                disabled={files.length === 0 || isBusy}
              >
                Start a New Merge
              </button>
            </div>
          </section>
        </div>
      </section>

      <ConfirmModal
        open={confirmAction !== null}
        title="Start a new merge?"
        message="This will remove the current PDF list and export setup so you can begin again."
        confirmLabel="Start New Merge"
        onConfirm={handleStartNewMerge}
        onCancel={() => setConfirmAction(null)}
      />
    </>
  );
}
