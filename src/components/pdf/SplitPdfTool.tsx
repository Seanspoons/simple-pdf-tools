import { useEffect, useMemo, useRef, useState } from 'react';
import { ConfirmModal } from '../ConfirmModal';
import { FloatingMessage } from '../FloatingMessage';
import { UploadPanel } from '../UploadPanel';
import splitSelectedPdfIcon from '../../assets/split-selected-pdf.svg';
import splitAllPdfIcon from '../../assets/split-all-pdf.svg';
import splitRangePdfIcon from '../../assets/split-range-pdf.svg';
import { clearToolDraft, loadToolDraft, saveToolDraft } from '../../utils/toolDraftStore';
import { PdfPagePreview, renderPdfPagePreviews } from '../../utils/pdfPreview';
import {
  buildRangeFilename,
  buildSelectedPagesFilename,
  buildSinglePageFilename,
  createPdfBlobFromPageNumbers,
  downloadBlobSequence,
  parseSplitRanges
} from '../../utils/pdfSplit';

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

type ConfirmAction = 'clear' | null;

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

function SplitModeIcon({ mode }: { mode: SplitMode }) {
  const iconSrc =
    mode === 'selected-pages'
      ? splitSelectedPdfIcon
      : mode === 'every-page'
        ? splitAllPdfIcon
        : splitRangePdfIcon;

  return (
    <span className="split-mode-icon" aria-hidden="true">
      <img src={iconSrc} alt="" className="split-mode-icon-image" />
    </span>
  );
}

export function SplitPdfTool() {
  const hasRestoredDraftRef = useRef(false);
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<SplitMode>('selected-pages');
  const [pages, setPages] = useState<SplitPage[]>([]);
  const [rangesText, setRangesText] = useState('1-2\n3-4');
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [previewStatus, setPreviewStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [isBusy, setIsBusy] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const selectedPages = useMemo(
    () => sortNumbersAscending(pages.filter((page) => page.selected).map((page) => page.pageNumber)),
    [pages]
  );

  const parsedRanges = useMemo(() => {
    if (!pageCount || mode !== 'page-ranges') {
      return { ranges: [], error: null as string | null };
    }

    return parseSplitRanges(rangesText, pageCount);
  }, [mode, pageCount, rangesText]);

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

      void renderPdfPagePreviews(file, undefined, { maxWidth: 240, maxHeight: 320, maxScale: 1.5 })
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

  function selectAllPages() {
    setPages((current) => current.map((page) => ({ ...page, selected: true })));
  }

  function clearSelectedPages() {
    setPages((current) => current.map((page) => ({ ...page, selected: false })));
  }

  function handleStartNewSplit() {
    pendingSelectionRef.current = null;
    setFile(null);
    setMode('selected-pages');
    setPages([]);
    setRangesText('1-2\n3-4');
    setPageCount(null);
    setPreviewStatus('idle');
    setConfirmAction(null);
    setErrorMessage(null);
    setStatusMessage('Ready for a new split.');
    void clearToolDraft(SPLIT_DRAFT_ID);
  }

  async function exportSplit() {
    if (!file || !pageCount) {
      setErrorMessage('Choose a PDF file before exporting.');
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);

    try {
      if (mode === 'selected-pages') {
        if (selectedPages.length === 0) {
          setErrorMessage('Select one or more pages to export.');
          return;
        }

        const blob = await createPdfBlobFromPageNumbers(file, selectedPages);
        await downloadBlobSequence([
          {
            blob,
            filename: buildSelectedPagesFilename(file)
          }
        ]);
        setStatusMessage('Selected pages are ready.');
        return;
      }

      if (mode === 'every-page') {
        const outputs = await Promise.all(
          Array.from({ length: pageCount }, async (_, index) => ({
            blob: await createPdfBlobFromPageNumbers(file, [index + 1]),
            filename: buildSinglePageFilename(file, index + 1)
          }))
        );

        await downloadBlobSequence(outputs);
        setStatusMessage(`Downloaded ${outputs.length} split PDF files.`);
        return;
      }

      if (parsedRanges.error) {
        setErrorMessage(parsedRanges.error);
        return;
      }

      const outputs = await Promise.all(
        parsedRanges.ranges.map(async (range) => ({
          blob: await createPdfBlobFromPageNumbers(
            file,
            Array.from({ length: range.end - range.start + 1 }, (_, index) => range.start + index)
          ),
          filename: buildRangeFilename(file, range)
        }))
      );

      await downloadBlobSequence(outputs);
      setStatusMessage(`Downloaded ${outputs.length} split PDF files.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'The PDF could not be split.');
    } finally {
      setIsBusy(false);
    }
  }

  const exportSummary = useMemo(() => {
    if (!file || !pageCount) {
      return 'Upload a PDF to review the split output.';
    }

    if (mode === 'selected-pages') {
      if (selectedPages.length === 0) {
        return 'Select the pages you want to include in the new PDF.';
      }

      return `${selectedPages.length} page${selectedPages.length === 1 ? '' : 's'} will be exported as one PDF.`;
    }

    if (mode === 'every-page') {
      return `${pageCount} PDF files will be created, one for each page.`;
    }

    if (parsedRanges.error) {
      return parsedRanges.error;
    }

    return `${parsedRanges.ranges.length} PDF file${parsedRanges.ranges.length === 1 ? '' : 's'} will be created from your page ranges.`;
  }, [file, mode, pageCount, parsedRanges, selectedPages.length]);

  const plannedOutputs = useMemo(() => {
    if (!file || !pageCount) {
      return [];
    }

    if (mode === 'selected-pages') {
      if (selectedPages.length === 0) {
        return [];
      }

      return [
        {
          filename: buildSelectedPagesFilename(file),
          detail: `Pages ${selectedPages.join(', ')}`
        }
      ];
    }

    if (mode === 'every-page') {
      return Array.from({ length: pageCount }, (_, index) => ({
        filename: buildSinglePageFilename(file, index + 1),
        detail: `Page ${index + 1}`
      }));
    }

    if (parsedRanges.error) {
      return [];
    }

    return parsedRanges.ranges.map((range) => ({
      filename: buildRangeFilename(file, range),
      detail: range.start === range.end ? `Page ${range.start}` : `Pages ${range.start}-${range.end}`
    }));
  }, [file, mode, pageCount, parsedRanges, selectedPages]);

  const controls = (
    <div className="split-top-grid">
      <UploadPanel
        onFileSelect={handleFileSelect}
        disabled={false}
        fileName={file?.name}
        multiple={false}
        heading="Choose your PDF file"
        title="Choose PDF file"
        copy="Pick one PDF from your device. You can also drag and drop it here."
      />

      <section className="panel split-mode-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Step 2</p>
            <h2>Choose how to split it</h2>
          </div>
        </div>
        <div className="split-mode-grid">
          <button type="button" className={`choice-card ${mode === 'selected-pages' ? 'is-selected' : ''}`} onClick={() => setMode('selected-pages')}>
            <SplitModeIcon mode="selected-pages" />
            <span className="choice-card-body">
              <span className="choice-card-title">Extract selected pages</span>
              <span className="choice-card-copy">Choose the pages you want in one new PDF.</span>
            </span>
          </button>
          <button type="button" className={`choice-card ${mode === 'every-page' ? 'is-selected' : ''}`} onClick={() => setMode('every-page')}>
            <SplitModeIcon mode="every-page" />
            <span className="choice-card-body">
              <span className="choice-card-title">Split every page</span>
              <span className="choice-card-copy">Create one PDF file for each page.</span>
            </span>
          </button>
          <button type="button" className={`choice-card ${mode === 'page-ranges' ? 'is-selected' : ''}`} onClick={() => setMode('page-ranges')}>
            <SplitModeIcon mode="page-ranges" />
            <span className="choice-card-body">
              <span className="choice-card-title">Split by page ranges</span>
              <span className="choice-card-copy">Create one PDF for each range you enter.</span>
            </span>
          </button>
        </div>
        {mode === 'page-ranges' ? (
          <div className="split-range-editor">
            <label className="field-label" htmlFor="split-ranges">Page ranges</label>
            <textarea
              id="split-ranges"
              className="text-input split-range-input"
              value={rangesText}
              onChange={(event) => setRangesText(event.target.value)}
              rows={5}
              placeholder={'1-3\n4-6\n7-10'}
            />
            <p className="helper-text">Add one range per line, or separate them with commas.</p>
          </div>
        ) : null}
      </section>
    </div>
  );

  const preview = (
    <section className="panel split-work-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Step 3</p>
            <h2>Document pages</h2>
          </div>
          <div className="panel-heading-actions">
            {pageCount ? <span className="dimension-badge">{pageCount} pages</span> : null}
            {mode === 'selected-pages' ? (
              <>
                <button type="button" className="ghost-button" onClick={selectAllPages} disabled={!pages.length || isBusy}>
                  Select all
                </button>
                <button type="button" className="ghost-button" onClick={clearSelectedPages} disabled={!selectedPages.length || isBusy}>
                  Clear selection
                </button>
              </>
            ) : null}
          </div>
        </div>
        {previewStatus === 'loading' ? <div className="preview-placeholder"><p>Loading page previews…</p></div> : null}
        {previewStatus === 'error' ? <div className="preview-placeholder"><p>Preview unavailable.</p></div> : null}
        {previewStatus === 'ready' ? (
          <div className="split-page-grid">
            {pages.map((page) => (
              <button
                key={page.pageNumber}
                type="button"
                className={`thumb-card merge-thumb-card split-page-card ${page.selected ? 'is-selected' : ''}`}
                onClick={() => mode === 'selected-pages' && togglePageSelection(page.pageNumber)}
                disabled={mode !== 'selected-pages'}
              >
                {page.selected ? (
                  <span className="split-page-check" aria-hidden="true">
                    <span className="split-page-check-mark">✓</span>
                  </span>
                ) : null}
                <div className="merge-thumb-preview split-thumb-preview">
                  {page.previewUrl ? (
                    <img src={page.previewUrl} alt="" className="thumb-image split-thumb-image" />
                  ) : (
                    <div className={`merge-thumb-placeholder merge-thumb-placeholder-${page.previewOrientation}`}>
                      <span>Preview unavailable</span>
                    </div>
                  )}
                </div>
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
  );

  const exportPanel = (
    <section className="panel split-export-panel">
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
          {plannedOutputs.length > 0 ? (
            <div className="split-output-list">
              {plannedOutputs.slice(0, 6).map((output) => (
                <div key={output.filename} className="split-output-item">
                  <span className="split-output-name">{output.filename}</span>
                  <span className="split-output-detail">{output.detail}</span>
                </div>
              ))}
              {plannedOutputs.length > 6 ? (
                <p className="helper-text">And {plannedOutputs.length - 6} more output files.</p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      <div className="export-actions">
        <button
          type="button"
          className="primary-button"
          onClick={exportSplit}
          disabled={
            !file ||
            !pageCount ||
            isBusy ||
            previewStatus !== 'ready' ||
            (mode === 'selected-pages' && selectedPages.length === 0) ||
            (mode === 'page-ranges' && (!!parsedRanges.error || parsedRanges.ranges.length === 0))
          }
        >
          {mode === 'every-page' ? 'Export Split PDFs' : 'Export Split PDF'}
        </button>
        <button
          type="button"
          className="ghost-button"
          onClick={() => setConfirmAction('clear')}
          disabled={!file || isBusy}
        >
          Start a New Split
        </button>
      </div>
    </section>
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
              Split PDF keeps file upload and split settings together at the top, then gives the page preview a full-width work area.
            </p>
          </div>
        </div>
      </section>

      <div className="tool-flow split-tool-flow">
        {controls}
        {preview}
        {exportPanel}
      </div>

      <ConfirmModal
        open={confirmAction !== null}
        title="Start a new split?"
        message="This will remove the current PDF and split setup so you can begin again."
        confirmLabel="Start New Split"
        onConfirm={handleStartNewSplit}
        onCancel={() => setConfirmAction(null)}
      />
    </>
  );
}
