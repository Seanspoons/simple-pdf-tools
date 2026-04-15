import { useEffect, useMemo, useRef, useState } from 'react';
import { FloatingMessage } from '../FloatingMessage';
import { UploadPanel } from '../UploadPanel';
import { TwoColumnToolLayout } from '../layout/TwoColumnToolLayout';
import { clearToolDraft, loadToolDraft, saveToolDraft } from '../../utils/toolDraftStore';
import { PdfPagePreview, renderPdfPagePreviews } from '../../utils/pdfPreview';

type SplitMode = 'selected-pages' | 'every-page' | 'page-ranges';

type SplitPage = PdfPagePreview & {
  selected: boolean;
};

type StoredSplitDraft = {
  file: File;
  mode: SplitMode;
  selectedPages: number[];
  rangesText: string;
};

const SPLIT_DRAFT_ID = 'split-pdf-draft';

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function sortNumbersAscending(values: number[]) {
  return [...values].sort((a, b) => a - b);
}

export function SplitPdfTool() {
  const hasRestoredDraftRef = useRef(false);
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<SplitMode>('selected-pages');
  const [pages, setPages] = useState<SplitPage[]>([]);
  const [rangesText, setRangesText] = useState('1-2\n3-4');
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [previewStatus, setPreviewStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const selectedPages = useMemo(
    () => sortNumbersAscending(pages.filter((page) => page.selected).map((page) => page.pageNumber)),
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

    void loadToolDraft<StoredSplitDraft>(SPLIT_DRAFT_ID)
      .then((draft) => {
        if (isCancelled || !draft?.file) {
          hasRestoredDraftRef.current = true;
          return;
        }

        setFile(draft.file);
        setMode(draft.mode);
        setRangesText(draft.rangesText);
        setStatusMessage('Restored your last split setup.');

        // Selection is applied after previews load.
        pendingSelectionRef.current = new Set(draft.selectedPages);
        hasRestoredDraftRef.current = true;
      })
      .catch(() => {
        hasRestoredDraftRef.current = true;
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  const pendingSelectionRef = useRef<Set<number> | null>(null);

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

    void renderPdfPagePreviews(
      file,
      Array.from({ length: 300 }, (_, index) => index + 1),
      { maxWidth: 180, maxHeight: 220, maxScale: 1.1 }
    )
      .then(({ pageCount, previews }) => {
        if (isCancelled) {
          return;
        }

        const restoredSelection = pendingSelectionRef.current;
        pendingSelectionRef.current = null;

        setPageCount(pageCount);
        setPages(
          previews.map((preview) => ({
            ...preview,
            selected: restoredSelection ? restoredSelection.has(preview.pageNumber) : false
          }))
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
        void clearToolDraft(SPLIT_DRAFT_ID);
        return;
      }

      void saveToolDraft<StoredSplitDraft>(SPLIT_DRAFT_ID, {
        file,
        mode,
        selectedPages,
        rangesText
      });
    }, 180);

    return () => window.clearTimeout(timerId);
  }, [file, mode, rangesText, selectedPages]);

  function handleFileSelect(files: File[]) {
    const nextFile = files[0];
    if (!nextFile) {
      return;
    }

    pendingSelectionRef.current = null;
    setFile(nextFile);
    setPages([]);
    setPageCount(null);
    setPreviewStatus('idle');
    setStatusMessage(`${nextFile.name} is ready to split.`);
    setErrorMessage(null);
  }

  function togglePageSelection(pageNumber: number) {
    setPages((current) =>
      current.map((page) =>
        page.pageNumber === pageNumber ? { ...page, selected: !page.selected } : page
      )
    );
  }

  const controls = (
    <>
      <UploadPanel
        onFileSelect={handleFileSelect}
        disabled={false}
        fileName={file?.name}
        multiple={false}
        heading="Choose your PDF file"
        title="Choose PDF file"
        copy="Pick one PDF from your device. You can also drag and drop it here."
      />

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Step 2</p>
            <h2>Choose how to split it</h2>
          </div>
        </div>
        <div className="split-mode-grid">
          <button type="button" className={`choice-card ${mode === 'selected-pages' ? 'is-selected' : ''}`} onClick={() => setMode('selected-pages')}>
            <span className="choice-card-title">Extract selected pages</span>
            <span className="choice-card-copy">Choose the pages you want in one new PDF.</span>
          </button>
          <button type="button" className={`choice-card ${mode === 'every-page' ? 'is-selected' : ''}`} onClick={() => setMode('every-page')}>
            <span className="choice-card-title">Split every page</span>
            <span className="choice-card-copy">Create one PDF file for each page.</span>
          </button>
          <button type="button" className={`choice-card ${mode === 'page-ranges' ? 'is-selected' : ''}`} onClick={() => setMode('page-ranges')}>
            <span className="choice-card-title">Split by page ranges</span>
            <span className="choice-card-copy">Create one PDF for each range you enter.</span>
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Step 3</p>
            <h2>Review and export</h2>
          </div>
        </div>
        <p className="helper-text">{fileSummary}</p>
        <p className="helper-text">Split export is coming next in this implementation pass.</p>
      </section>
    </>
  );

  const preview = (
    <>
      <section className="panel tool-sticky-wrap">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Preview</p>
            <h2>Document pages</h2>
          </div>
          {pageCount ? <span className="dimension-badge">{pageCount} pages</span> : null}
        </div>
        {previewStatus === 'loading' ? <div className="preview-placeholder"><p>Loading page previews…</p></div> : null}
        {previewStatus === 'error' ? <div className="preview-placeholder"><p>Preview unavailable.</p></div> : null}
        {previewStatus === 'ready' ? (
          <div className="split-page-grid">
            {pages.map((page) => (
              <button
                key={page.pageNumber}
                type="button"
                className={`thumb-card split-page-card ${page.selected ? 'is-selected' : ''}`}
                onClick={() => mode === 'selected-pages' && togglePageSelection(page.pageNumber)}
                disabled={mode !== 'selected-pages'}
              >
                {page.previewUrl ? (
                  <img src={page.previewUrl} alt="" className="thumb-image split-thumb-image" />
                ) : (
                  <div className={`merge-thumb-placeholder merge-thumb-placeholder-${page.previewOrientation}`}>
                    <span>Preview unavailable</span>
                  </div>
                )}
                <div className="thumb-meta">
                  <span className="thumb-order">Page {page.pageNumber}</span>
                  <span className="thumb-drag-hint">
                    {mode === 'selected-pages' ? (page.selected ? 'Selected' : 'Tap to select') : 'Preview'}
                  </span>
                </div>
              </button>
            ))}
          </div>
        ) : null}
        {previewStatus === 'idle' ? <div className="preview-placeholder"><p>Upload a PDF to preview and split it.</p></div> : null}
      </section>
    </>
  );

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
            <p className="eyebrow">Split PDF</p>
            <h1>Break one PDF into smaller files right in your browser.</h1>
            <p className="hero-copy">
              Upload a PDF, preview its pages, choose a split mode, and export the sections you need without sending files to a server.
            </p>
            <div className="hero-tags" aria-label="Split PDF highlights">
              <span className="hero-tag">Select pages</span>
              <span className="hero-tag">Split every page</span>
              <span className="hero-tag">Private in browser</span>
            </div>
          </div>
        </div>
        <div className="hero-card">
          <p className="hero-stat-label">Your split</p>
          <p className="hero-stat">{fileSummary}</p>
          <div className="tip-note" role="note">
            <span className="tip-note-icon" aria-hidden="true">i</span>
            <p className="helper-text">
              Split PDF uses a side-by-side workflow so your split settings stay visible while you inspect pages.
            </p>
          </div>
        </div>
      </section>

      <TwoColumnToolLayout
        className="split-tool-layout"
        main={controls}
        side={preview}
      />
    </>
  );
}
