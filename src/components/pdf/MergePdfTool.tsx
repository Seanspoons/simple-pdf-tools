import { ChangeEvent, DragEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ConfirmModal } from '../ConfirmModal';
import { FloatingMessage } from '../FloatingMessage';
import { triggerDownload } from '../../utils/exportImage';

type MergeItem = {
  id: string;
  file: File;
  previewUrl: string | null;
  pageCount: number | null;
  previewStatus: 'idle' | 'loading' | 'ready' | 'error';
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

function moveItem<T>(items: T[], fromIndex: number, toIndex: number) {
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

async function renderPdfPreview(file: File) {
  const [{ getDocument, GlobalWorkerOptions }, workerModule] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')
  ]);

  GlobalWorkerOptions.workerSrc = workerModule.default;

  const bytes = new Uint8Array(await file.arrayBuffer());
  const pdf = await getDocument({ data: bytes }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 1 });
  const scale = Math.min(220 / viewport.width, 280 / viewport.height, 1.4);
  const scaledViewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('The browser could not prepare a PDF preview.');
  }

  canvas.width = Math.ceil(scaledViewport.width);
  canvas.height = Math.ceil(scaledViewport.height);
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({
    canvas,
    canvasContext: context,
    viewport: scaledViewport
  }).promise;

  return {
    previewUrl: canvas.toDataURL('image/png'),
    pageCount: pdf.numPages
  };
}

export function MergePdfTool() {
  const inputRef = useRef<HTMLInputElement>(null);
  const cardRefs = useRef(new Map<string, HTMLElement>());
  const previousPositionsRef = useRef(new Map<string, DOMRect>());
  const didDropRef = useRef(false);
  const dragPreviewRef = useRef<HTMLElement | null>(null);
  const draggedIdRef = useRef<string | null>(null);
  const targetIndexRef = useRef<number | null>(null);
  const [files, setFiles] = useState<MergeItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [targetIndex, setTargetIndex] = useState<number | null>(null);

  function setDraggedItemId(value: string | null) {
    draggedIdRef.current = value;
    setDraggedId(value);
  }

  function setDropTargetIndex(value: number | null) {
    targetIndexRef.current = value;
    setTargetIndex(value);
  }

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

  const previewItems = useMemo(() => {
    if (!draggedId || targetIndex === null) {
      return files.map((item) => ({ type: 'file' as const, item }));
    }

    const draggedItem = files.find((item) => item.id === draggedId);
    if (!draggedItem) {
      return files.map((item) => ({ type: 'file' as const, item }));
    }

    const withoutDragged = files.filter((item) => item.id !== draggedId);
    const clampedIndex = Math.max(0, Math.min(targetIndex, withoutDragged.length));

    return [
      ...withoutDragged.slice(0, clampedIndex).map((item) => ({ type: 'file' as const, item })),
      { type: 'placeholder' as const, id: 'merge-drop-slot' },
      ...withoutDragged.slice(clampedIndex).map((item) => ({ type: 'file' as const, item }))
    ];
  }, [files, draggedId, targetIndex]);

  useEffect(() => {
    return () => {
      dragPreviewRef.current?.remove();
      setFiles((current) => {
        current.forEach((item) => {
          if (item.previewUrl) {
            URL.revokeObjectURL(item.previewUrl);
          }
        });
        return [];
      });
    };
  }, []);

  useEffect(() => {
    const pendingItems = files.filter((item) => item.previewStatus === 'idle');
    if (pendingItems.length === 0) {
      return;
    }

    let isCancelled = false;

    pendingItems.forEach((item) => {
      setFiles((current) =>
        current.map((entry) =>
          entry.id === item.id ? { ...entry, previewStatus: 'loading' } : entry
        )
      );

      void renderPdfPreview(item.file)
        .then(({ previewUrl, pageCount }) => {
          if (isCancelled) {
            return;
          }

          setFiles((current) =>
            current.map((entry) =>
              entry.id === item.id
                ? {
                    ...entry,
                    previewUrl,
                    pageCount,
                    previewStatus: 'ready'
                  }
                : entry
            )
          );
        })
        .catch(() => {
          if (isCancelled) {
            return;
          }

          setFiles((current) =>
            current.map((entry) =>
              entry.id === item.id
                ? {
                    ...entry,
                    previewStatus: 'error'
                  }
                : entry
            )
          );
        });
    });

    return () => {
      isCancelled = true;
    };
  }, [files]);

  useLayoutEffect(() => {
    const nextPositions = new Map<string, DOMRect>();

    previewItems.forEach((entry) => {
      if (entry.type !== 'file') {
        return;
      }

      const node = cardRefs.current.get(entry.item.id);
      if (!node) {
        return;
      }

      const nextBox = node.getBoundingClientRect();
      const previousBox = previousPositionsRef.current.get(entry.item.id);

      if (previousBox) {
        const deltaX = previousBox.left - nextBox.left;
        const deltaY = previousBox.top - nextBox.top;

        if (deltaX !== 0 || deltaY !== 0) {
          node.style.transition = 'none';
          node.style.transform = `translate(${deltaX}px, ${deltaY}px)`;

          requestAnimationFrame(() => {
            node.style.transition = 'transform 220ms ease, box-shadow 140ms ease, border-color 140ms ease';
            node.style.transform = '';
          });
        }
      }

      nextPositions.set(entry.item.id, nextBox);
    });

    previousPositionsRef.current = nextPositions;
  }, [previewItems]);

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
        file,
        previewUrl: null,
        pageCount: null,
        previewStatus: 'idle'
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
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= files.length) {
      return;
    }

    setFiles((current) => moveItem(current, index, nextIndex));
    setStatusMessage('Updated the merge order.');
  }

  function removeFile(id: string) {
    setFiles((current) => {
      const next = current.filter((item) => item.id !== id);
      const removed = current.find((item) => item.id === id);
      if (removed?.previewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(removed.previewUrl);
      }
      return next;
    });
    setStatusMessage('Updated the merge order.');
  }

  function clearDragPreview() {
    if (dragPreviewRef.current) {
      dragPreviewRef.current.remove();
      dragPreviewRef.current = null;
    }
  }

  function handleCardDragStart(event: DragEvent<HTMLElement>, itemId: string) {
    const startIndex = files.findIndex((item) => item.id === itemId);
    if (startIndex === -1) {
      return;
    }

    clearDragPreview();

    const sourceCard = event.currentTarget;
    const dragPreview = sourceCard.cloneNode(true) as HTMLElement;
    const sourceBounds = sourceCard.getBoundingClientRect();

    dragPreview.classList.add('merge-drag-preview');
    dragPreview.style.width = `${sourceBounds.width}px`;
    dragPreview.style.height = `${sourceBounds.height}px`;
    dragPreview.style.position = 'fixed';
    dragPreview.style.top = '-1000px';
    dragPreview.style.left = '-1000px';
    dragPreview.style.pointerEvents = 'none';
    dragPreview.style.zIndex = '9999';
    document.body.appendChild(dragPreview);

    event.dataTransfer.setDragImage(
      dragPreview,
      Math.min(sourceBounds.width / 2, 56),
      Math.min(sourceBounds.height / 2, 72)
    );

    dragPreviewRef.current = dragPreview;
    didDropRef.current = false;

    // Let the browser establish the native drag session before React swaps
    // the source tile for the placeholder slot.
    requestAnimationFrame(() => {
      setDraggedItemId(itemId);
      setDropTargetIndex(startIndex);
    });
  }

  function updateDropTarget(event: DragEvent<HTMLElement>, hoveredId: string) {
    if (!draggedId) {
      return;
    }

    const draggedIndex = files.findIndex((item) => item.id === draggedId);
    const hoveredIndex = files.findIndex((item) => item.id === hoveredId);

    if (draggedIndex === -1 || hoveredIndex === -1) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const shouldInsertAfter = event.clientX > bounds.left + bounds.width / 2;
    let nextIndex = hoveredIndex + (shouldInsertAfter ? 1 : 0);

    if (draggedIndex < nextIndex) {
      nextIndex -= 1;
    }

    setDropTargetIndex(Math.max(0, Math.min(nextIndex, files.length - 1)));
  }

  function commitDrop() {
    const currentDraggedId = draggedIdRef.current;
    const currentTargetIndex = targetIndexRef.current;

    if (!currentDraggedId || currentTargetIndex === null) {
      return;
    }

    setFiles((current) => {
      const fromIndex = current.findIndex((item) => item.id === currentDraggedId);
      if (fromIndex === -1) {
        return current;
      }

      const nextIndex = Math.max(0, Math.min(currentTargetIndex, current.length - 1));
      if (fromIndex === nextIndex) {
        return current;
      }

      return moveItem(current, fromIndex, nextIndex);
    });

    didDropRef.current = true;
    setStatusMessage('Updated the merge order.');
  }

  function handleCommitDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    commitDrop();
    setDraggedItemId(null);
    setDropTargetIndex(null);
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
    setFiles((current) => {
      current.forEach((item) => {
        if (item.previewUrl?.startsWith('blob:')) {
          URL.revokeObjectURL(item.previewUrl);
        }
      });
      return [];
    });
    setDraggedItemId(null);
    setDropTargetIndex(null);
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
              Add multiple PDF files, check actual page previews, drag them into order, and export
              one merged document with the same step-based flow as the original tools.
            </p>
            <div className="hero-tags" aria-label="Merge PDF highlights">
              <span className="hero-tag">Multiple PDF files</span>
              <span className="hero-tag">Drag to reorder</span>
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
              On desktop you can drag the preview cards to change the order before exporting.
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

      <div className="merge-flow-stack">
        <section className="panel merge-step-panel merge-step-upload">
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

        <section className="panel merge-step-panel merge-step-arrange">
          <div className="panel-heading merge-step-heading-center">
            <div>
              <p className="eyebrow">Step 2</p>
              <h2>Arrange the order</h2>
            </div>
            {files.length > 0 ? <span className="dimension-badge">{formatBytes(totalSize)}</span> : null}
          </div>

          {files.length > 0 ? (
            <div
              className="merge-arrange-grid"
              onDragOver={(event) => {
                event.preventDefault();
              }}
              onDrop={handleCommitDrop}
            >
                {previewItems.map((entry) => {
                  if (entry.type === 'placeholder') {
                    return (
                      <div
                        key={entry.id}
                        className="merge-drop-slot"
                        aria-hidden="true"
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={handleCommitDrop}
                      />
                    );
                  }

                  const item = entry.item;
                  const index = files.findIndex((file) => file.id === item.id);

                  return (
                    <article
                    key={item.id}
                    ref={(node) => {
                      if (node) {
                        cardRefs.current.set(item.id, node);
                      } else {
                        cardRefs.current.delete(item.id);
                      }
                    }}
                    className={`thumb-card merge-thumb-card ${draggedId === item.id ? 'is-dragging' : ''}`}
                    draggable={!isBusy}
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = 'move';
                      event.dataTransfer.setData('text/plain', item.id);
                      handleCardDragStart(event, item.id);
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      updateDropTarget(event, item.id);
                    }}
                    onDrop={handleCommitDrop}
                    onDragEnd={() => {
                      const dropped = didDropRef.current;
                      didDropRef.current = false;
                      clearDragPreview();
                      setDraggedItemId(null);
                      setDropTargetIndex(null);

                      if (!dropped) {
                        setStatusMessage(null);
                      }
                    }}
                  >
                  <button
                    type="button"
                    className="thumb-remove-button"
                    onClick={() => removeFile(item.id)}
                    disabled={isBusy}
                    aria-label={`Remove ${item.file.name}`}
                  >
                    ×
                  </button>
                  <div className="merge-thumb-preview">
                    {item.previewStatus === 'ready' && item.previewUrl ? (
                      <img src={item.previewUrl} alt="" className="thumb-image" />
                    ) : (
                      <div className="thumb-image merge-thumb-placeholder">
                        <span>{item.previewStatus === 'error' ? 'Preview unavailable' : 'Loading preview...'}</span>
                      </div>
                    )}
                  </div>
                  <div className="thumb-meta">
                    <span className="thumb-order">#{index + 1}</span>
                    <span className="thumb-drag-hint">
                      {item.pageCount ? `${item.pageCount} page${item.pageCount === 1 ? '' : 's'}` : 'PDF'}
                    </span>
                  </div>
                  <p className="thumb-label">{item.file.name}</p>
                  <div className="merge-mobile-actions">
                    <button
                      type="button"
                      className="thumb-inline-button"
                      onClick={() => moveFile(index, -1)}
                      disabled={index === 0 || isBusy}
                    >
                      Move Up
                    </button>
                    <button
                      type="button"
                      className="thumb-inline-button"
                      onClick={() => moveFile(index, 1)}
                      disabled={index === files.length - 1 || isBusy}
                    >
                      Move Down
                    </button>
                  </div>
                </article>
                  );
                })}
            </div>
          ) : (
            <div className="preview-placeholder">
              <p>Add PDF files first, then drag the cards here to reorder them.</p>
            </div>
          )}
        </section>

        <section className="panel merge-step-panel merge-step-export">
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
                  The final PDF keeps the pages from each file in the order shown in Step 2.
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
