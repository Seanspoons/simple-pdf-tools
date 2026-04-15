import { CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCorners,
  DragEndEvent,
  DragStartEvent,
  DragCancelEvent,
  DragOverlay
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
  arrayMove,
  defaultAnimateLayoutChanges
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ConfirmModal } from '../ConfirmModal';
import { FloatingMessage } from '../FloatingMessage';
import { triggerDownload } from '../../utils/exportPDF';
import { UploadPanel } from '../UploadPanel';
import { clearToolDraft, loadToolDraft, saveToolDraft } from '../../utils/toolDraftStore';
import { PreviewOrientation, renderPdfFirstPagePreview } from '../../utils/pdfPreview';

type MergeItem = {
  id: string;
  file: File;
  previewUrl: string | null;
  pageCount: number | null;
  previewStatus: 'idle' | 'loading' | 'ready' | 'error';
  previewOrientation: PreviewOrientation;
  rotation: 0 | 90 | 180 | 270;
  visualRotation: number;
};

type ConfirmAction = 'clear' | null;

type StoredMergeDraft = {
  files: Array<{
    id: string;
    file: File;
    rotation: MergeItem['rotation'];
    visualRotation: number;
  }>;
};

const MERGE_DRAFT_ID = 'merge-pdf-draft';

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

function rotateClockwise(rotation: MergeItem['rotation']): MergeItem['rotation'] {
  if (rotation === 270) {
    return 0;
  }

  return (rotation + 90) as MergeItem['rotation'];
}

export function MergePdfTool() {
  const cardRefs = useRef(new Map<string, HTMLElement>());
  const previewJobsRef = useRef(new Set<string>());
  const hasRestoredDraftRef = useRef(false);
  const [files, setFiles] = useState<MergeItem[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const [activeId, setActiveId] = useState<string | null>(null);

  // dnd-kit sensors
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 4
      }
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 0,
        tolerance: 12
      }
    })
  );

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
    let isCancelled = false;

    void loadToolDraft<StoredMergeDraft>(MERGE_DRAFT_ID)
      .then((draft) => {
        if (isCancelled || !draft?.files.length) {
          hasRestoredDraftRef.current = true;
          return;
        }

        setFiles(
          draft.files.map((item) => ({
            id: item.id,
            file: item.file,
            previewUrl: null,
            pageCount: null,
            previewStatus: 'idle',
            previewOrientation: 'portrait',
            rotation: item.rotation,
            visualRotation: item.visualRotation
          }))
        );
        setStatusMessage('Restored your last merge.');
        hasRestoredDraftRef.current = true;
      })
      .catch(() => {
        hasRestoredDraftRef.current = true;
      });

    return () => {
      isCancelled = true;
      previewJobsRef.current.clear();
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
    if (!hasRestoredDraftRef.current) {
      return;
    }

    const timerId = window.setTimeout(() => {
      if (files.length === 0) {
        void clearToolDraft(MERGE_DRAFT_ID);
        return;
      }

      void saveToolDraft<StoredMergeDraft>(MERGE_DRAFT_ID, {
        files: files.map((item) => ({
          id: item.id,
          file: item.file,
          rotation: item.rotation,
          visualRotation: item.visualRotation
        }))
      });
    }, 180);

    return () => window.clearTimeout(timerId);
  }, [files]);

  useEffect(() => {
    const pendingItems = files.filter(
      (item) => item.previewStatus === 'idle' && !previewJobsRef.current.has(item.id)
    );
    if (pendingItems.length === 0) {
      return;
    }

    pendingItems.forEach((item) => {
      previewJobsRef.current.add(item.id);

      setFiles((current) =>
        current.map((entry) =>
          entry.id === item.id ? { ...entry, previewStatus: 'loading' } : entry
        )
      );

      void renderPdfFirstPagePreview(item.file)
        .then(({ previewUrl, pageCount, previewOrientation }) => {
          setFiles((current) =>
            current.map((entry) =>
              entry.id === item.id
                ? {
                    ...entry,
                    previewUrl,
                    pageCount,
                    previewOrientation,
                    previewStatus: previewUrl ? 'ready' : 'error'
                  }
                : entry
            )
          );
          previewJobsRef.current.delete(item.id);
        })
        .catch(() => {
          setFiles((current) =>
            current.map((entry) =>
              entry.id === item.id
                ? {
                    ...entry,
                    previewOrientation: 'portrait',
                    previewStatus: 'error'
                  }
                : entry
            )
          );
          previewJobsRef.current.delete(item.id);
        });
    });
  }, [files]);


  function addFiles(incoming: File[] | FileList | null) {
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
        previewStatus: 'idle',
        previewOrientation: 'portrait',
        rotation: 0,
        visualRotation: 0
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

  function rotateFile(id: string) {
    setFiles((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              rotation: rotateClockwise(item.rotation),
              visualRotation: item.visualRotation + 90
            }
          : item
      )
    );
    setStatusMessage('Updated page rotation.');
  }



  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragCancel(_event: DragCancelEvent) {
    setActiveId(null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) {
      return;
    }

    setFiles((items) => {
      const oldIndex = items.findIndex((i) => i.id === active.id);
      const newIndex = items.findIndex((i) => i.id === over.id);

      if (oldIndex === -1 || newIndex === -1) {
        return items;
      }

      return arrayMove(items, oldIndex, newIndex);
    });

    setStatusMessage('Updated the merge order.');
  }

  function renderMergeCardContent(
    item: MergeItem,
    index: number,
    isBusy: boolean,
    rotateFile: (id: string) => void,
    removeFile: (id: string) => void
  ) {
    return (
      <>
        <div className="merge-thumb-actions">
          <button
            type="button"
            className="merge-thumb-action-button merge-thumb-rotate-button"
            onClick={() => rotateFile(item.id)}
            disabled={isBusy}
            aria-label={`Rotate ${item.file.name} 90 degrees clockwise`}
          >
            ↻
          </button>
          <button
            type="button"
            className="merge-thumb-action-button merge-thumb-remove-button"
            onClick={() => removeFile(item.id)}
            disabled={isBusy}
            aria-label={`Remove ${item.file.name}`}
          >
            ×
          </button>
        </div>
        <div className="merge-thumb-preview">
          {item.previewStatus === 'ready' && item.previewUrl ? (
            <img
              src={item.previewUrl}
              alt=""
              className="thumb-image"
              style={{ transform: `rotate(${item.visualRotation}deg)` }}
            />
          ) : (
            <div
              className={`merge-thumb-placeholder merge-thumb-placeholder-${item.previewOrientation}`}
              style={{ transform: `rotate(${item.visualRotation}deg)` }}
            >
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
      </>
    );
  }


  function SortableItem({
    item,
    index,
    isBusy,
    rotateFile,
    removeFile,
    cardRefs,
    activeId
  }: {
    item: MergeItem;
    index: number;
    isBusy: boolean;
    rotateFile: (id: string) => void;
    removeFile: (id: string) => void;
    cardRefs: React.MutableRefObject<Map<string, HTMLElement>>;
    activeId: string | null;
  }) {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging
    } = useSortable({
      id: item.id,
      transition: {
        duration: 140,
        easing: 'ease-out'
      },
      animateLayoutChanges: (args) => {
        if (args.isDragging) return false;
        return defaultAnimateLayoutChanges(args);
      }
    });

    const isDragOrigin = activeId === item.id;
    const style: CSSProperties = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: 1,
      borderStyle: undefined,
      borderColor: undefined,
      borderWidth: undefined,
      background: undefined,
      boxShadow: undefined,
      zIndex: isDragging ? 2 : undefined
    };

    return (
      <article
        ref={(node) => {
          setNodeRef(node);
          if (node) cardRefs.current.set(item.id, node);
          else cardRefs.current.delete(item.id);
        }}
        style={style}
        {...attributes}
        {...listeners}
        className={`thumb-card merge-thumb-card ${isDragging ? 'is-dragging' : ''} ${isDragOrigin ? 'merge-thumb-card-placeholder' : ''}`}
      >
        {isDragOrigin ? null : renderMergeCardContent(item, index, isBusy, rotateFile, removeFile)}
      </article>
    );
  }

  function DragPreviewCard({ item }: { item: MergeItem }) {
    return (
      <article
        className="thumb-card merge-thumb-card is-dragging"
        style={{
          boxShadow: '0 18px 40px rgba(28, 24, 19, 0.16)',
          transform: 'scale(1.02)',
          cursor: 'grabbing'
        }}
      >
        {renderMergeCardContent(item, 0, true, () => {}, () => {})}
      </article>
    );
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
      const { PDFDocument, degrees } = await import('pdf-lib');
      const mergedPdf = await PDFDocument.create();

      for (const item of files) {
        const sourceBytes = await item.file.arrayBuffer();
        const sourcePdf = await PDFDocument.load(sourceBytes);
        const copiedPages = await mergedPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());
        copiedPages.forEach((page) => {
          if (item.rotation !== 0) {
            page.setRotation(degrees(item.rotation));
          }

          mergedPdf.addPage(page);
        });
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
              Upload multiple PDFs, preview pages, arrange them with drag-and-drop, and export a single merged document using a simple step-by-step flow.
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
        <UploadPanel
          onFileSelect={(selectedFiles) => {
            void addFiles(selectedFiles);
          }}
          disabled={isBusy}
          fileName={
            files.length === 1
              ? files[0]?.file.name
              : files.length > 1
                ? `${files.length} files selected`
                : undefined
          }
        />

        <section className="panel merge-step-panel merge-step-arrange">
          <div className="panel-heading merge-step-heading-center">
            <div>
              <p className="eyebrow">Step 2</p>
              <h2>Arrange the order</h2>
            </div>
            {files.length > 0 ? <span className="dimension-badge">{formatBytes(totalSize)}</span> : null}
          </div>

          {files.length > 0 ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragCancel={handleDragCancel}
            >
              <SortableContext items={files.map((f) => f.id)} strategy={rectSortingStrategy}>
                <div className="merge-arrange-grid">
                  {files.map((item, index) => (
                    <SortableItem
                      key={item.id}
                      item={item}
                      index={index}
                      isBusy={isBusy}
                      rotateFile={rotateFile}
                      removeFile={removeFile}
                      cardRefs={cardRefs}
                      activeId={activeId}
                    />
                  ))}
                </div>
              </SortableContext>
              <DragOverlay dropAnimation={null}>
                {activeId
                  ? (() => {
                      const activeItem = files.find((item) => item.id === activeId);
                      return activeItem ? <DragPreviewCard item={activeItem} /> : null;
                    })()
                  : null}
              </DragOverlay>
            </DndContext>
          ) : (
            <div className="preview-placeholder">
              <p>Add PDF files first, then drag the cards here to reorder them.</p>
            </div>
          )}
        </section>

        <section className="panel merge-step-panel">
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
