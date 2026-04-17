import { useEffect, useMemo, useRef, useState } from 'react';
import { ConfirmModal } from '../ConfirmModal';
import { FloatingMessage } from '../FloatingMessage';
import { UploadPanel } from '../UploadPanel';
import { triggerDownload } from '../../utils/exportPDF';
import { clearToolDraft, loadToolDraft, saveToolDraft } from '../../utils/toolDraftStore';
import { PdfPagePreview, renderPdfPagePreviews } from '../../utils/pdfPreview';

type PdfRotation = 0 | 90 | 180 | 270;

type RotatePage = PdfPagePreview & {
  selected: boolean;
  rotation: PdfRotation;
  visualRotation: number;
};

type ConfirmAction = 'clear' | null;

type StoredRotateDraft = {
  file: File;
  selectedPages: number[];
  rotations: Array<{
    pageNumber: number;
    rotation: PdfRotation;
    visualRotation: number;
  }>;
};

type StoredRotationMap = Map<number, { rotation: PdfRotation; visualRotation: number }>;

const ROTATE_DRAFT_ID = 'rotate-pdf-draft';

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function createRotatedFilename(file: File) {
  const baseName = file.name.replace(/\.pdf$/i, '') || 'rotated-pdf';
  return `${baseName}-rotated.pdf`;
}

function rotateClockwise(rotation: PdfRotation): PdfRotation {
  if (rotation === 270) {
    return 0;
  }

  return (rotation + 90) as PdfRotation;
}

function rotateCounterClockwise(rotation: PdfRotation): PdfRotation {
  if (rotation === 0) {
    return 270;
  }

  return (rotation - 90) as PdfRotation;
}

function describeRotation(rotation: PdfRotation) {
  if (rotation === 0) {
    return 'Original';
  }

  return `${rotation}° rotated`;
}

function createRotationMap(items: StoredRotateDraft['rotations']): StoredRotationMap {
  return new Map(
    items.map((item) => [
      item.pageNumber,
      {
        rotation: item.rotation,
        visualRotation: item.visualRotation
      }
    ])
  );
}

export function RotatePdfTool() {
  const hasRestoredDraftRef = useRef(false);
  const pendingSelectionRef = useRef<Set<number> | null>(null);
  const pendingRotationRef = useRef<StoredRotationMap | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<RotatePage[]>([]);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [previewStatus, setPreviewStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [isBusy, setIsBusy] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const selectedPages = useMemo(
    () => pages.filter((page) => page.selected).map((page) => page.pageNumber),
    [pages]
  );

  const rotatedPages = useMemo(
    () => pages.filter((page) => page.rotation !== 0).map((page) => page.pageNumber),
    [pages]
  );

  const fileSummary = useMemo(() => {
    if (!file) {
      return 'Choose a PDF file to get started.';
    }

    return `${file.name} • ${formatBytes(file.size)}${pageCount ? ` • ${pageCount} pages` : ''}`;
  }, [file, pageCount]);

  useEffect(() => {
    let isCancelled = false;

    void loadToolDraft<StoredRotateDraft>(ROTATE_DRAFT_ID)
      .then((draft) => {
        if (isCancelled || !draft?.file) {
          hasRestoredDraftRef.current = true;
          return;
        }

        setFile(draft.file);
        pendingSelectionRef.current = new Set(draft.selectedPages);
        pendingRotationRef.current = createRotationMap(draft.rotations);
        setStatusMessage('Restored your last rotation setup.');
        hasRestoredDraftRef.current = true;
      })
      .catch(() => {
        hasRestoredDraftRef.current = true;
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!file) {
      setPages([]);
      setPageCount(null);
      setPreviewStatus('idle');
      return;
    }

    let isCancelled = false;
    setPreviewStatus('loading');
    setErrorMessage(null);

    void renderPdfPagePreviews(file, undefined, { maxWidth: 240, maxHeight: 320, maxScale: 1.5 })
      .then(({ pageCount: nextPageCount, previews }) => {
        if (isCancelled) {
          return;
        }

        const restoredSelection = pendingSelectionRef.current;
        const restoredRotations = pendingRotationRef.current;
        pendingSelectionRef.current = null;
        pendingRotationRef.current = null;

        setPageCount(nextPageCount);
        setPages(
          previews.map((preview) => {
            const storedRotation = restoredRotations?.get(preview.pageNumber);

            return {
              ...preview,
              selected: restoredSelection ? restoredSelection.has(preview.pageNumber) : false,
              rotation: storedRotation?.rotation ?? 0,
              visualRotation: storedRotation?.visualRotation ?? 0
            };
          })
        );
        setPreviewStatus('ready');
      })
      .catch((error) => {
        if (isCancelled) {
          return;
        }

        setPreviewStatus('error');
        setErrorMessage(error instanceof Error ? error.message : 'The PDF preview could not be loaded.');
      });

    return () => {
      isCancelled = true;
    };
  }, [file]);

  useEffect(() => {
    if (!hasRestoredDraftRef.current) {
      return;
    }

    const timerId = window.setTimeout(() => {
      if (!file) {
        void clearToolDraft(ROTATE_DRAFT_ID);
        return;
      }

      void saveToolDraft<StoredRotateDraft>(ROTATE_DRAFT_ID, {
        file,
        selectedPages,
        rotations: pages.map((page) => ({
          pageNumber: page.pageNumber,
          rotation: page.rotation,
          visualRotation: page.visualRotation
        }))
      });
    }, 180);

    return () => window.clearTimeout(timerId);
  }, [file, pages, selectedPages]);

  function handleFileSelect(files: File[]) {
    const nextFile = files[0];
    if (!nextFile) {
      return;
    }

    pendingSelectionRef.current = null;
    pendingRotationRef.current = null;
    setFile(nextFile);
    setPages([]);
    setPageCount(null);
    setPreviewStatus('idle');
    setErrorMessage(null);
    setStatusMessage(`${nextFile.name} is ready to rotate.`);
  }

  function togglePageSelection(pageNumber: number) {
    setPages((current) =>
      current.map((page) =>
        page.pageNumber === pageNumber ? { ...page, selected: !page.selected } : page
      )
    );
  }

  function selectAllPages() {
    setPages((current) => current.map((page) => ({ ...page, selected: true })));
  }

  function clearSelectedPages() {
    setPages((current) => current.map((page) => ({ ...page, selected: false })));
  }

  function rotatePages(direction: 'left' | 'right', scope: 'selected' | 'all') {
    if (scope === 'selected' && selectedPages.length === 0) {
      setErrorMessage('Select one or more pages to rotate.');
      return;
    }

    setErrorMessage(null);
    setPages((current) =>
      current.map((page) => {
        const shouldRotate = scope === 'all' || page.selected;
        if (!shouldRotate) {
          return page;
        }

        return {
          ...page,
          rotation:
            direction === 'right'
              ? rotateClockwise(page.rotation)
              : rotateCounterClockwise(page.rotation),
          visualRotation: page.visualRotation + (direction === 'right' ? 90 : -90)
        };
      })
    );
  }

  function handleStartNewRotate() {
    pendingSelectionRef.current = null;
    pendingRotationRef.current = null;
    setFile(null);
    setPages([]);
    setPageCount(null);
    setPreviewStatus('idle');
    setIsBusy(false);
    setConfirmAction(null);
    setErrorMessage(null);
    setStatusMessage('Ready for a new PDF.');
    void clearToolDraft(ROTATE_DRAFT_ID);
  }

  async function exportRotatedPdf() {
    if (!file || pages.length === 0) {
      setErrorMessage('Choose a PDF file before exporting.');
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);

    try {
      const { PDFDocument, degrees } = await import('pdf-lib');
      const pdfDoc = await PDFDocument.load(await file.arrayBuffer());
      const docPages = pdfDoc.getPages();

      pages.forEach((page, index) => {
        const targetPage = docPages[index];
        if (!targetPage || page.rotation === 0) {
          return;
        }

        const nextRotation = (targetPage.getRotation().angle + page.rotation) % 360;
        targetPage.setRotation(degrees(nextRotation));
      });

      const outputBytes = await pdfDoc.save();
      const outputCopy = new Uint8Array(outputBytes.length);
      outputCopy.set(outputBytes);
      triggerDownload(
        new Blob([outputCopy.buffer as ArrayBuffer], { type: 'application/pdf' }),
        createRotatedFilename(file)
      );
      setStatusMessage(
        rotatedPages.length === 0
          ? 'Downloaded a clean copy of your PDF.'
          : `Downloaded your rotated PDF with ${rotatedPages.length} updated page${rotatedPages.length === 1 ? '' : 's'}.`
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'The PDF could not be rotated.');
    } finally {
      setIsBusy(false);
    }
  }

  const exportSummary = useMemo(() => {
    if (!file || !pageCount) {
      return 'Upload a PDF to review the output.';
    }

    if (rotatedPages.length === 0) {
      return 'Choose pages and rotate them left or right before exporting.';
    }

    return `${rotatedPages.length} page${rotatedPages.length === 1 ? '' : 's'} will be rotated in the exported PDF.`;
  }, [file, pageCount, rotatedPages.length]);

  return (
    <>
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

      <section className="hero">
        <div className="hero-copy-block">
          <div>
            <p className="eyebrow">Rotate PDF</p>
            <h1>Fix sideways pages and mixed document orientation in your browser.</h1>
            <p className="hero-copy">
              Upload one PDF, preview every page, rotate the pages that need it, and export one corrected file without sending anything to a server.
            </p>
            <div className="hero-tags" aria-label="Rotate PDF highlights">
              <span className="hero-tag">Rotate selected pages</span>
              <span className="hero-tag">Rotate all pages</span>
              <span className="hero-tag">Private in browser</span>
            </div>
          </div>
        </div>
        <div className="hero-card">
          <p className="hero-stat-label">Your document</p>
          <p className="hero-stat">{fileSummary}</p>
          <div className="tip-note" role="note">
            <span className="tip-note-icon" aria-hidden="true">i</span>
            <p className="helper-text">
              Select only the pages that need fixing, or rotate the full document in one step.
            </p>
          </div>
        </div>
      </section>

      <div className="tool-flow rotate-tool-flow">
        <div className="rotate-top-grid">
          <UploadPanel
            onFileSelect={handleFileSelect}
            disabled={false}
            fileName={file?.name}
            multiple={false}
            heading="Choose your PDF file"
            title="Choose PDF file"
            copy="Pick one PDF from your device. You can also drag and drop it here."
          />

          <section className="panel rotate-actions-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Step 2</p>
                <h2>Choose what to rotate</h2>
              </div>
            </div>
            <div className="rotate-action-grid">
              <button
                type="button"
                className="rotate-action-button"
                onClick={() => rotatePages('left', 'selected')}
                disabled={!pages.length || isBusy}
              >
                <span className="rotate-action-label">Rotate selected left</span>
                <span className="rotate-action-copy">Turn the pages you selected 90° counterclockwise.</span>
              </button>
              <button
                type="button"
                className="rotate-action-button"
                onClick={() => rotatePages('right', 'selected')}
                disabled={!pages.length || isBusy}
              >
                <span className="rotate-action-label">Rotate selected right</span>
                <span className="rotate-action-copy">Turn the pages you selected 90° clockwise.</span>
              </button>
              <button
                type="button"
                className="rotate-action-button"
                onClick={() => rotatePages('left', 'all')}
                disabled={!pages.length || isBusy}
              >
                <span className="rotate-action-label">Rotate all left</span>
                <span className="rotate-action-copy">Rotate the full document 90° counterclockwise.</span>
              </button>
              <button
                type="button"
                className="rotate-action-button"
                onClick={() => rotatePages('right', 'all')}
                disabled={!pages.length || isBusy}
              >
                <span className="rotate-action-label">Rotate all right</span>
                <span className="rotate-action-copy">Rotate the full document 90° clockwise.</span>
              </button>
            </div>
            <p className="helper-text rotate-action-note">
              Click pages below to select them first when you only want to rotate part of the document.
            </p>
          </section>
        </div>

        <section className="panel rotate-work-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Step 3</p>
              <h2>Preview pages</h2>
            </div>
            <div className="panel-heading-actions">
              {pageCount ? <span className="dimension-badge">{pageCount} pages</span> : null}
              <button
                type="button"
                className="ghost-button"
                onClick={selectAllPages}
                disabled={!pages.length || isBusy}
              >
                Select all
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={clearSelectedPages}
                disabled={!selectedPages.length || isBusy}
              >
                Clear selection
              </button>
            </div>
          </div>

          {previewStatus === 'loading' ? (
            <div className="preview-placeholder">
              <p>Loading page previews…</p>
            </div>
          ) : null}

          {previewStatus === 'error' ? (
            <div className="preview-placeholder">
              <p>Preview unavailable.</p>
            </div>
          ) : null}

          {previewStatus === 'ready' ? (
            <div className="split-page-grid rotate-page-grid">
              {pages.map((page) => (
                <button
                  key={page.pageNumber}
                  type="button"
                  className={`thumb-card merge-thumb-card split-page-card rotate-page-card ${page.selected ? 'is-selected' : ''}`}
                  onClick={() => togglePageSelection(page.pageNumber)}
                >
                  {page.selected ? (
                    <span className="split-page-check" aria-hidden="true">
                      <span className="split-page-check-mark">✓</span>
                    </span>
                  ) : null}
                  <div className="merge-thumb-preview split-thumb-preview rotate-thumb-preview">
                    {page.previewUrl ? (
                      <img
                        src={page.previewUrl}
                        alt=""
                        className="thumb-image split-thumb-image rotate-thumb-image"
                        style={{ transform: `rotate(${page.visualRotation}deg)` }}
                      />
                    ) : (
                      <div className={`merge-thumb-placeholder merge-thumb-placeholder-${page.previewOrientation}`}>
                        <span>Preview unavailable</span>
                      </div>
                    )}
                  </div>
                  <div className="thumb-meta">
                    <span className="thumb-order">Page {page.pageNumber}</span>
                    <span className="thumb-drag-hint">{describeRotation(page.rotation)}</span>
                  </div>
                </button>
              ))}
            </div>
          ) : null}

          {previewStatus === 'idle' ? (
            <div className="preview-placeholder">
              <p>Upload a PDF to preview and rotate it.</p>
            </div>
          ) : null}
        </section>

        <section className="panel rotate-export-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Step 4</p>
              <h2>Review and export</h2>
            </div>
          </div>
          <div className="export-preview-block">
            <p className="helper-text export-preview-label">Export summary</p>
            <div className="export-preview-shell">
              <p className="helper-text">{fileSummary}</p>
              <p className="helper-text">{exportSummary}</p>
              {file ? (
                <div className="split-output-list">
                  <div className="split-output-item">
                    <span className="split-output-name">{createRotatedFilename(file)}</span>
                    <span className="split-output-detail">
                      {rotatedPages.length === 0
                        ? 'No page rotations yet'
                        : rotatedPages.length === pageCount
                          ? 'All pages updated'
                          : `Pages ${rotatedPages.join(', ')}`}
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
          <div className="export-actions">
            <button
              type="button"
              className="primary-button"
              onClick={exportRotatedPdf}
              disabled={!file || !pages.length || isBusy || previewStatus !== 'ready'}
            >
              Export Rotated PDF
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={() => setConfirmAction('clear')}
              disabled={!file || isBusy}
            >
              Start a New PDF
            </button>
          </div>
        </section>
      </div>

      <ConfirmModal
        open={confirmAction !== null}
        title="Start over?"
        message="This will remove the current PDF and page rotations so you can begin again."
        confirmLabel="Start New PDF"
        onConfirm={handleStartNewRotate}
        onCancel={() => setConfirmAction(null)}
      />
    </>
  );
}
