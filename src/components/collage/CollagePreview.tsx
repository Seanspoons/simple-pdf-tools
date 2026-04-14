import {
  ReactNode,
  DragEvent,
  PointerEvent as ReactPointerEvent,
  RefObject,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { MAX_COLLAGE_COLUMNS } from '../../constants';
import {
  CollageLayoutMetrics,
  CollagePackedTile
} from '../../utils/collage/renderCollage';

type ResizeHandleMode =
  | 'left'
  | 'right'
  | 'top'
  | 'bottom'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right';

interface CollagePreviewProps {
  stepLabel?: string;
  title?: string;
  panelClassName?: string;
  canvasRef: RefObject<HTMLCanvasElement>;
  hasImages: boolean;
  imageCount: number;
  canBuild: boolean;
  helperText?: string;
  exportFrameNote?: string;
  headerActionsSlot?: ReactNode;
  controlsSlot?: ReactNode;
  previewCells?: CollagePackedTile[];
  previewMetrics?: CollageLayoutMetrics | null;
  gap?: number;
  backgroundColor?: string;
  previewCornerRadius?: number;
  previewImageUrls?: string[];
  isInteractive?: boolean;
  allowTouchMove?: boolean;
  selectedIndex?: number;
  draggedIndex?: number | null;
  dropTargetIndex?: number | null;
  onTileSelect?: (index: number) => void;
  onTileDragStart?: (index: number) => void;
  onTileDragEnter?: (index: number) => void;
  onTileDropAt?: (index: number, column: number, row: number) => void;
  onTileDragEnd?: () => void;
  onTileResizePreview?: (
    index: number,
    colSpan: number,
    rowSpan: number,
    mode: ResizeHandleMode
  ) => void;
  onTileResizeCommit?: (
    index: number,
    colSpan: number,
    rowSpan: number,
    mode: ResizeHandleMode
  ) => void;
  onTileResizeCancel?: () => void;
}

export function CollagePreview({
  stepLabel = 'Step 3',
  title = 'Preview',
  panelClassName,
  canvasRef,
  hasImages,
  imageCount,
  canBuild,
  helperText,
  exportFrameNote,
  headerActionsSlot,
  controlsSlot,
  previewCells = [],
  previewMetrics = null,
  gap = 0,
  backgroundColor = '#ffffff',
  previewCornerRadius = 0,
  previewImageUrls = [],
  isInteractive = false,
  allowTouchMove = false,
  selectedIndex = 0,
  draggedIndex = null,
  dropTargetIndex = null,
  onTileSelect,
  onTileDragStart,
  onTileDragEnter,
  onTileDropAt,
  onTileDragEnd,
  onTileResizePreview,
  onTileResizeCommit,
  onTileResizeCancel
}: CollagePreviewProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const dragImageRef = useRef<HTMLImageElement | null>(null);
  const activeDragIndexRef = useRef<number | null>(null);
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });
  const [localDraggedIndex, setLocalDraggedIndex] = useState<number | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [hoveredEmptySlot, setHoveredEmptySlot] = useState<{ column: number; row: number } | null>(null);
  const [activeResizePreview, setActiveResizePreview] = useState<{
    index: number;
    colSpan: number;
    rowSpan: number;
  } | null>(null);
  const dragOffsetRef = useRef<{ column: number; row: number }>({ column: 0, row: 0 });
  const effectiveDraggedIndex = localDraggedIndex ?? draggedIndex;
  const resizeStateRef = useRef<{
    index: number;
    pointerId: number;
    mode: ResizeHandleMode;
    startX: number;
    startY: number;
    startColSpan: number;
    startRowSpan: number;
    nextColSpan: number;
    nextRowSpan: number;
    maxColSpan: number;
  } | null>(null);
  const pointerDragStateRef = useRef<{
    index: number;
    pointerId: number;
  } | null>(null);
  const isActivelyInteracting = effectiveDraggedIndex !== null || activeResizePreview !== null;

  useEffect(() => {
    if (!shellRef.current) {
      return;
    }

    const updateSize = () => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }

      setDisplaySize({
        width: canvas.clientWidth,
        height: canvas.clientHeight
      });
    };

    updateSize();
    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(shellRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [canvasRef, canBuild, hasImages, previewCells.length]);

  const scaledCells = useMemo(() => {
    const canvas = canvasRef.current;
    if (!canvas || displaySize.width === 0 || displaySize.height === 0) {
      return [];
    }

    const scaleX = displaySize.width / canvas.width;
    const scaleY = displaySize.height / canvas.height;

    const scale = Math.min(scaleX, scaleY);

    return previewCells.map((cell) => ({
      id: cell.id,
      index: cell.index,
      column: cell.column,
      row: cell.row,
      colSpan: cell.colSpan,
      rowSpan: cell.rowSpan,
      x: cell.x * scaleX,
      y: cell.y * scaleY,
      width: cell.width * scaleX,
      height: cell.height * scaleY,
      borderRadius: previewCornerRadius * scale
    }));
  }, [canvasRef, displaySize.height, displaySize.width, previewCells, previewCornerRadius]);

  const scaledFrame = useMemo(() => {
    if (scaledCells.length === 0) {
      return null;
    }

    return {
      x: Math.min(...scaledCells.map((cell) => cell.x)),
      y: Math.min(...scaledCells.map((cell) => cell.y)),
      width:
        Math.max(...scaledCells.map((cell) => cell.x + cell.width)) -
        Math.min(...scaledCells.map((cell) => cell.x)),
      height:
        Math.max(...scaledCells.map((cell) => cell.y + cell.height)) -
        Math.min(...scaledCells.map((cell) => cell.y))
    };
  }, [scaledCells]);

  const scaledGridGuides = useMemo(() => {
    const canvas = canvasRef.current;
    if (!canvas || !previewMetrics || displaySize.width === 0 || displaySize.height === 0) {
      return [];
    }

    const scaleX = displaySize.width / canvas.width;
    const scaleY = displaySize.height / canvas.height;
    const stepWidth = previewMetrics.cellSize * scaleX;
    const stepHeight = previewMetrics.cellSize * scaleY;
    const scaledGapX = gap * scaleX;
    const scaledGapY = gap * scaleY;
    const offsetX = ((canvas.width - previewMetrics.gridWidth) / 2) * scaleX;
    const offsetY = ((canvas.height - previewMetrics.gridHeight) / 2) * scaleY;
    const guides: Array<{
      column: number;
      row: number;
      x: number;
      y: number;
      width: number;
      height: number;
      borderRadius: number;
    }> = [];

    for (let row = 0; row < previewMetrics.frameRows; row += 1) {
      for (let column = 0; column < previewMetrics.columns; column += 1) {
        guides.push({
          column,
          row,
          x: offsetX + column * (stepWidth + scaledGapX),
          y: offsetY + row * (stepHeight + scaledGapY),
          width: stepWidth,
          height: stepHeight,
          borderRadius: previewCornerRadius * Math.min(scaleX, scaleY)
        });
      }
    }

    return guides;
  }, [canvasRef, displaySize.height, displaySize.width, gap, previewMetrics]);

  const emptyGridGuides = useMemo(() => {
    const occupied = new Set<string>();
    scaledCells.forEach((cell) => {
      if (effectiveDraggedIndex !== null && cell.index === effectiveDraggedIndex) {
        return;
      }

      for (let rowOffset = 0; rowOffset < cell.rowSpan; rowOffset += 1) {
        for (let columnOffset = 0; columnOffset < cell.colSpan; columnOffset += 1) {
          occupied.add(`${cell.column + columnOffset}:${cell.row + rowOffset}`);
        }
      }
    });

    return scaledGridGuides.filter((guide) => !occupied.has(`${guide.column}:${guide.row}`));
  }, [effectiveDraggedIndex, scaledCells, scaledGridGuides]);

  const guideAppearance = useMemo(() => {
    const normalizedColor = backgroundColor.trim().toLowerCase();
    const hex = normalizedColor.startsWith('#') ? normalizedColor.slice(1) : normalizedColor;
    const expandedHex =
      hex.length === 3
        ? hex
            .split('')
            .map((value) => `${value}${value}`)
            .join('')
        : hex;

    if (!/^[0-9a-f]{6}$/i.test(expandedHex)) {
      return {
        guideBorder: 'rgba(31, 59, 45, 0.12)',
        guideFill: 'rgba(255, 255, 255, 0.12)',
        guideShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.38)',
        emptyBorder: 'rgba(217, 162, 77, 0.32)',
        emptyFill: 'rgba(217, 162, 77, 0.06)',
        emptyShadow: 'inset 0 0 0 1px rgba(255, 248, 236, 0.34)',
        emptyHoverBorder: 'rgba(217, 162, 77, 0.82)',
        emptyHoverFill: 'rgba(217, 162, 77, 0.14)',
        emptyHoverShadow: 'inset 0 0 0 1px rgba(255, 248, 236, 0.54)'
      };
    }

    const red = parseInt(expandedHex.slice(0, 2), 16);
    const green = parseInt(expandedHex.slice(2, 4), 16);
    const blue = parseInt(expandedHex.slice(4, 6), 16);
    const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;

    return luminance < 0.45
      ? {
          guideBorder: 'rgba(255, 255, 255, 0.72)',
          guideFill: 'rgba(255, 255, 255, 0.14)',
          guideShadow: 'inset 0 0 0 1px rgba(24, 32, 27, 0.18)',
          emptyBorder: 'rgba(255, 243, 214, 0.96)',
          emptyFill: 'rgba(255, 243, 214, 0.24)',
          emptyShadow: 'inset 0 0 0 1px rgba(24, 32, 27, 0.16)',
          emptyHoverBorder: 'rgba(255, 243, 214, 1)',
          emptyHoverFill: 'rgba(255, 243, 214, 0.34)',
          emptyHoverShadow: 'inset 0 0 0 1px rgba(24, 32, 27, 0.2)'
        }
      : {
          guideBorder: 'rgba(31, 59, 45, 0.12)',
          guideFill: 'rgba(255, 255, 255, 0.12)',
          guideShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.38)',
          emptyBorder: 'rgba(217, 162, 77, 0.32)',
          emptyFill: 'rgba(217, 162, 77, 0.06)',
          emptyShadow: 'inset 0 0 0 1px rgba(255, 248, 236, 0.34)',
          emptyHoverBorder: 'rgba(217, 162, 77, 0.82)',
          emptyHoverFill: 'rgba(217, 162, 77, 0.14)',
          emptyHoverShadow: 'inset 0 0 0 1px rgba(255, 248, 236, 0.54)'
        };
  }, [backgroundColor]);

  const getGuideCellFromPointer = (clientX: number, clientY: number) => {
    const shellRect = shellRef.current?.getBoundingClientRect();
    if (!shellRect) {
      return null;
    }

    const relativeX = clientX - shellRect.left;
    const relativeY = clientY - shellRect.top;

    return (
      scaledGridGuides.find(
        (guide) =>
          relativeX >= guide.x &&
          relativeX <= guide.x + guide.width &&
          relativeY >= guide.y &&
          relativeY <= guide.y + guide.height
      ) ?? null
    );
  };

  const getAnchorFromTarget = (
    column: number,
    row: number,
    colSpan: number,
    _rowSpan: number
  ) => ({
    column: Math.max(
      0,
      Math.min(MAX_COLLAGE_COLUMNS - colSpan, column - dragOffsetRef.current.column)
    ),
    row: Math.max(0, row - dragOffsetRef.current.row)
  });

  const handleTileDragStart = (
    event: DragEvent<HTMLDivElement>,
    index: number,
    cell: (typeof scaledCells)[number]
  ) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(index));

    if (dragImageRef.current) {
      dragImageRef.current.remove();
      dragImageRef.current = null;
    }

    const previewImageUrl = previewImageUrls[index];
    if (previewImageUrl) {
      const dragImage = document.createElement('img');
      dragImage.src = previewImageUrl;
      dragImage.width = 96;
      dragImage.height = 96;
      dragImage.style.position = 'absolute';
      dragImage.style.top = '-9999px';
      dragImage.style.left = '-9999px';
      dragImage.style.borderRadius = '16px';
      dragImage.style.pointerEvents = 'none';
      document.body.appendChild(dragImage);
      dragImageRef.current = dragImage;
      event.dataTransfer.setDragImage(dragImage, 48, 48);
    }

    const guideCell = getGuideCellFromPointer(event.clientX, event.clientY);
    dragOffsetRef.current = guideCell
      ? {
          column: Math.max(0, Math.min(cell.colSpan - 1, guideCell.column - cell.column)),
          row: Math.max(0, Math.min(cell.rowSpan - 1, guideCell.row - cell.row))
        }
      : { column: 0, row: 0 };

    setHoveredEmptySlot(null);
    activeDragIndexRef.current = index;
    setLocalDraggedIndex(index);
    onTileDragStart?.(index);
  };

  const handleTileDragEnd = () => {
    if (dragImageRef.current) {
      dragImageRef.current.remove();
      dragImageRef.current = null;
    }

    setHoveredEmptySlot(null);
    dragOffsetRef.current = { column: 0, row: 0 };
    activeDragIndexRef.current = null;
    setLocalDraggedIndex(null);
    onTileDragEnd?.();
  };

  const getDesktopDragIndex = (event: DragEvent<HTMLElement>) => {
    const rawIndex = event.dataTransfer.getData('text/plain');
    const parsedIndex = Number(rawIndex);
    return Number.isInteger(parsedIndex) ? parsedIndex : null;
  };

  const handleDesktopDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const dragIndex = getDesktopDragIndex(event);
    if (dragIndex === null) {
      return;
    }

    activeDragIndexRef.current = dragIndex;
    setLocalDraggedIndex(dragIndex);
    const target = getPointerDropTarget(event.clientX, event.clientY);
    if (!target) {
      setHoveredIndex(null);
      setHoveredEmptySlot(null);
      return;
    }

    if (target.type === 'cell') {
      setHoveredEmptySlot(null);
      setHoveredIndex(target.index);
      onTileDragEnter?.(target.index);
      return;
    }

    setHoveredIndex(null);
    setHoveredEmptySlot({ column: target.column, row: target.row });
  };

  const handleDesktopDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const dragIndex = getDesktopDragIndex(event);
    if (dragIndex === null) {
      return;
    }

    const target = getPointerDropTarget(event.clientX, event.clientY);
    if (!target) {
      handleTileDragEnd();
      return;
    }

    if (target.type === 'cell') {
      const draggedCell = scaledCells.find((cell) => cell.index === dragIndex);
      handleEmptySlotDrop(
        dragIndex,
        target.column,
        target.row,
        draggedCell?.colSpan ?? 1,
        draggedCell?.rowSpan ?? 1
      );
      return;
    }

    handleEmptySlotDrop(dragIndex, target.column, target.row);
  };

  const draggedPreviewRect = useMemo(() => {
    if (effectiveDraggedIndex === null || !previewMetrics) {
      return null;
    }

    const draggedCell = scaledCells.find((cell) => cell.index === effectiveDraggedIndex);
    if (!draggedCell) {
      return null;
    }

    const anchorSource =
      hoveredEmptySlot ??
      scaledCells.find((cell) => cell.index === dropTargetIndex) ??
      null;

    if (!anchorSource) {
      return null;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      return null;
    }

    const scaleX = displaySize.width / canvas.width;
    const scaleY = displaySize.height / canvas.height;
    const cellWidth = previewMetrics.cellSize * scaleX;
    const cellHeight = previewMetrics.cellSize * scaleY;
    const scaledGapX = gap * scaleX;
    const scaledGapY = gap * scaleY;
    const offsetX = ((canvas.width - previewMetrics.gridWidth) / 2) * scaleX;
    const offsetY = ((canvas.height - previewMetrics.gridHeight) / 2) * scaleY;

    const anchor = getAnchorFromTarget(
      anchorSource.column,
      anchorSource.row,
      draggedCell.colSpan,
      draggedCell.rowSpan
    );

    return {
      x: offsetX + anchor.column * (cellWidth + scaledGapX),
      y: offsetY + anchor.row * (cellHeight + scaledGapY),
      width: cellWidth * draggedCell.colSpan + scaledGapX * (draggedCell.colSpan - 1),
      height: cellHeight * draggedCell.rowSpan + scaledGapY * (draggedCell.rowSpan - 1),
      borderRadius: draggedCell.borderRadius
    };
  }, [
    canvasRef,
    displaySize.height,
    displaySize.width,
    effectiveDraggedIndex,
    dropTargetIndex,
    gap,
    hoveredEmptySlot,
    previewMetrics,
    scaledCells
  ]);

  const handleEmptySlotDrop = (
    tileIndex: number,
    column: number,
    row: number,
    colSpan = 1,
    rowSpan = 1
  ) => {
    setHoveredEmptySlot(null);
    const anchor = getAnchorFromTarget(column, row, colSpan, rowSpan);
    onTileDropAt?.(tileIndex, anchor.column, anchor.row);
  };

  const getPointerDropTarget = (clientX: number, clientY: number) => {
    const shellRect = shellRef.current?.getBoundingClientRect();
    if (!shellRect) {
      return null;
    }

    const relativeX = clientX - shellRect.left;
    const relativeY = clientY - shellRect.top;

    const cellTarget = scaledCells.find(
      (cell) =>
        cell.index !== effectiveDraggedIndex &&
        relativeX >= cell.x &&
        relativeX <= cell.x + cell.width &&
        relativeY >= cell.y &&
        relativeY <= cell.y + cell.height
    );

    if (cellTarget) {
      return {
        type: 'cell' as const,
        index: cellTarget.index,
        column: cellTarget.column,
        row: cellTarget.row
      };
    }

    const emptyTarget = emptyGridGuides.find(
      (guide) =>
        relativeX >= guide.x &&
        relativeX <= guide.x + guide.width &&
        relativeY >= guide.y &&
        relativeY <= guide.y + guide.height
    );

    if (emptyTarget) {
      return { type: 'empty' as const, column: emptyTarget.column, row: emptyTarget.row };
    }

    return null;
  };

  const handlePointerDragStart = (
    event: ReactPointerEvent<HTMLDivElement>,
    index: number,
    cell: (typeof scaledCells)[number]
  ) => {
    if (!isInteractive) {
      return;
    }

    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const guideCell = getGuideCellFromPointer(event.clientX, event.clientY);
    dragOffsetRef.current = guideCell
      ? {
          column: Math.max(0, Math.min(cell.colSpan - 1, guideCell.column - cell.column)),
          row: Math.max(0, Math.min(cell.rowSpan - 1, guideCell.row - cell.row))
        }
      : { column: 0, row: 0 };
    activeDragIndexRef.current = index;
    setLocalDraggedIndex(index);
    pointerDragStateRef.current = { index, pointerId: event.pointerId };
    setHoveredEmptySlot(null);
    onTileSelect?.(index);
    onTileDragStart?.(index);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerDragMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const dragState = pointerDragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    const target = getPointerDropTarget(event.clientX, event.clientY);
    if (!target) {
      setHoveredIndex(null);
      setHoveredEmptySlot(null);
      return;
    }

    if (target.type === 'cell') {
      setHoveredEmptySlot(null);
      setHoveredIndex(target.index);
      onTileDragEnter?.(target.index);
      return;
    }

    setHoveredIndex(null);
    setHoveredEmptySlot({ column: target.column, row: target.row });
  };

  const handlePointerDragEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    const dragState = pointerDragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    const target = getPointerDropTarget(event.clientX, event.clientY);
    if (event.pointerId === dragState.pointerId) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (target?.type === 'cell') {
      const draggedCell = scaledCells.find((cell) => cell.index === dragState.index);
      handleEmptySlotDrop(
        dragState.index,
        target.column,
        target.row,
        draggedCell?.colSpan ?? 1,
        draggedCell?.rowSpan ?? 1
      );
    } else if (target?.type === 'empty') {
      handleEmptySlotDrop(dragState.index, target.column, target.row);
    } else {
      onTileDragEnd?.();
    }

    pointerDragStateRef.current = null;
    setHoveredIndex(null);
    setHoveredEmptySlot(null);
    dragOffsetRef.current = { column: 0, row: 0 };
    activeDragIndexRef.current = null;
    setLocalDraggedIndex(null);
  };

  const handlePointerDragCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    const dragState = pointerDragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    if (event.pointerId === dragState.pointerId) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    pointerDragStateRef.current = null;
    setHoveredIndex(null);
    setHoveredEmptySlot(null);
    dragOffsetRef.current = { column: 0, row: 0 };
    activeDragIndexRef.current = null;
    setLocalDraggedIndex(null);
    onTileDragEnd?.();
  };

  const handleResizeStart = (
    event: ReactPointerEvent<HTMLButtonElement>,
    cell: (typeof scaledCells)[number],
    mode: ResizeHandleMode
  ) => {
    if (!previewMetrics) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    resizeStateRef.current = {
      index: cell.index,
      pointerId: event.pointerId,
      mode,
      startX: event.clientX,
      startY: event.clientY,
      startColSpan: cell.colSpan,
      startRowSpan: cell.rowSpan,
      nextColSpan: cell.colSpan,
      nextRowSpan: cell.rowSpan,
      maxColSpan: Math.max(1, MAX_COLLAGE_COLUMNS - cell.column)
    };
    setActiveResizePreview({
      index: cell.index,
      colSpan: cell.colSpan,
      rowSpan: cell.rowSpan
    });
    onTileSelect?.(cell.index);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleResizeMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const resizeState = resizeStateRef.current;
    const canvas = canvasRef.current;
    if (!resizeState || !previewMetrics || !canvas) {
      return;
    }

    const scaleX = displaySize.width / canvas.width;
    const scaleY = displaySize.height / canvas.height;
    const horizontalStep = (previewMetrics.cellSize + gap) * scaleX;
    const verticalStep = (previewMetrics.cellSize + gap) * scaleY;
    const snapUnits = (distance: number, step: number) => {
      const raw = distance / Math.max(step, 1);
      return raw >= 0 ? Math.floor(raw + 0.35) : Math.ceil(raw - 0.35);
    };

    const rawDeltaColumns = event.clientX - resizeState.startX;
    const rawDeltaRows = event.clientY - resizeState.startY;
    const affectsLeft = resizeState.mode.includes('left');
    const affectsRight = resizeState.mode.includes('right');
    const affectsTop = resizeState.mode.includes('top');
    const affectsBottom = resizeState.mode.includes('bottom');
    const isCorner =
      (affectsLeft || affectsRight) && (affectsTop || affectsBottom);
    const deltaColumns =
      affectsLeft
        ? snapUnits(-rawDeltaColumns, horizontalStep)
        : affectsRight
          ? snapUnits(rawDeltaColumns, horizontalStep)
          : 0;
    const deltaRows =
      affectsTop
        ? snapUnits(-rawDeltaRows, verticalStep)
        : affectsBottom
          ? snapUnits(rawDeltaRows, verticalStep)
          : 0;

    const squareDelta = isCorner ? Math.round((deltaColumns + deltaRows) / 2) : 0;

    const nextColSpan = Math.min(
      resizeState.maxColSpan,
      Math.max(
        1,
        resizeState.startColSpan + (isCorner ? squareDelta : deltaColumns)
      )
    );
    const nextRowSpan = Math.min(
      8,
      Math.max(
        1,
        resizeState.startRowSpan + (isCorner ? squareDelta : deltaRows)
      )
    );

    resizeState.nextColSpan = nextColSpan;
    resizeState.nextRowSpan = nextRowSpan;
    setActiveResizePreview({
      index: resizeState.index,
      colSpan: nextColSpan,
      rowSpan: nextRowSpan
    });
    onTileResizePreview?.(resizeState.index, nextColSpan, nextRowSpan, resizeState.mode);
  };

  const handleResizeEnd = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const resizeState = resizeStateRef.current;
    if (!resizeState) {
      return;
    }

    if (event.pointerId === resizeState.pointerId) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    onTileResizeCommit?.(
      resizeState.index,
      resizeState.nextColSpan,
      resizeState.nextRowSpan,
      resizeState.mode
    );
    resizeStateRef.current = null;
    setActiveResizePreview(null);
  };

  const handleResizeCancel = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const resizeState = resizeStateRef.current;
    if (!resizeState) {
      return;
    }

    if (event.pointerId === resizeState.pointerId) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    resizeStateRef.current = null;
    setActiveResizePreview(null);
    onTileResizeCancel?.();
  };

  return (
    <section className={`panel preview-panel ${panelClassName ?? ''}`.trim()}>
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{stepLabel}</p>
          <h2>{title}</h2>
        </div>
        <div className="preview-panel-heading-meta">
          {headerActionsSlot}
          {hasImages ? <span className="dimension-badge">{imageCount} photos</span> : null}
        </div>
      </div>

      <div
        ref={shellRef}
        className="preview-shell collage-preview-shell"
        onDragOver={handleDesktopDragOver}
        onDrop={handleDesktopDrop}
      >
        {hasImages ? (
          canBuild ? (
            <>
              <canvas
                ref={canvasRef}
                className="preview-canvas collage-preview-canvas"
                aria-label="Collage preview"
              />
              {isInteractive && scaledCells.length > 0 && scaledFrame ? (
                <div
                  className="preview-dropzone-layer"
                  aria-hidden="true"
                  style={{
                    left: '0px',
                    top: '0px',
                    width: `${displaySize.width}px`,
                    height: `${displaySize.height}px`
                  }}
                >
                  {scaledGridGuides.map((guide, index) => (
                    <span
                      key={`guide-${index}`}
                      className="preview-grid-guide"
                      style={{
                        left: `${guide.x}px`,
                        top: `${guide.y}px`,
                        width: `${guide.width}px`,
                        height: `${guide.height}px`,
                        borderRadius: `${guide.borderRadius}px`,
                        borderColor: guideAppearance.guideBorder,
                        background: guideAppearance.guideFill,
                        boxShadow: guideAppearance.guideShadow
                      }}
                    />
                  ))}
                  {effectiveDraggedIndex !== null
                    ? emptyGridGuides.map((guide) => (
                        <button
                          key={`empty-${guide.column}-${guide.row}`}
                          type="button"
                          className={`preview-empty-dropzone ${
                            hoveredEmptySlot?.column === guide.column &&
                            hoveredEmptySlot?.row === guide.row
                              ? 'is-hovered'
                              : ''
                          }`}
                          style={{
                            left: `${guide.x}px`,
                            top: `${guide.y}px`,
                            width: `${guide.width}px`,
                            height: `${guide.height}px`,
                            borderRadius: `${guide.borderRadius}px`,
                            borderColor:
                              hoveredEmptySlot?.column === guide.column &&
                              hoveredEmptySlot?.row === guide.row
                                ? guideAppearance.emptyHoverBorder
                                : guideAppearance.emptyBorder,
                            background:
                              hoveredEmptySlot?.column === guide.column &&
                              hoveredEmptySlot?.row === guide.row
                                ? guideAppearance.emptyHoverFill
                                : guideAppearance.emptyFill,
                            boxShadow:
                              hoveredEmptySlot?.column === guide.column &&
                              hoveredEmptySlot?.row === guide.row
                                ? guideAppearance.emptyHoverShadow
                                : guideAppearance.emptyShadow
                          }}
                          tabIndex={-1}
                          onDragEnter={() => setHoveredEmptySlot({ column: guide.column, row: guide.row })}
                          onDragOver={(event) => event.preventDefault()}
                        />
                      ))
                    : null}
                  {draggedPreviewRect ? (
                    <span
                      className="preview-drag-footprint"
                      style={{
                        left: `${draggedPreviewRect.x}px`,
                        top: `${draggedPreviewRect.y}px`,
                        width: `${draggedPreviewRect.width}px`,
                        height: `${draggedPreviewRect.height}px`,
                        borderRadius: `${draggedPreviewRect.borderRadius}px`
                      }}
                    />
                  ) : null}
                  {scaledCells.map((cell, index) => (
                    <div
                      key={cell.id}
                      role="button"
                      aria-label={`Tile ${index + 1}`}
                      className={`preview-dropzone ${
                        selectedIndex === index ? 'is-selected' : ''
                      } ${
                        effectiveDraggedIndex === index ? 'is-dragging' : ''
                      } ${dropTargetIndex === index && effectiveDraggedIndex !== index ? 'is-drop-target' : ''} ${
                        hoveredIndex === index && effectiveDraggedIndex === null ? 'is-hovered' : ''
                      } ${
                        activeResizePreview?.index === index ? 'is-resize-preview' : ''
                      } ${
                        activeResizePreview && activeResizePreview.index !== index
                          ? 'is-resize-background'
                          : ''
                      } ${isActivelyInteracting ? 'is-direct-manipulation' : ''}`}
                      style={{
                        left: `${cell.x}px`,
                        top: `${cell.y}px`,
                        width: `${cell.width}px`,
                        height: `${cell.height}px`,
                        borderRadius: `${cell.borderRadius}px`
                      }}
                      draggable={false}
                      tabIndex={0}
                      onClick={() => onTileSelect?.(index)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          onTileSelect?.(index);
                        }
                      }}
                      onDragStart={(event) => handleTileDragStart(event, index, cell)}
                      onDragEnter={() => {
                        setHoveredEmptySlot(null);
                        onTileDragEnter?.(index);
                      }}
                      onDragOver={(event) => event.preventDefault()}
                      onDragEnd={handleTileDragEnd}
                      onPointerDown={(event) => handlePointerDragStart(event, index, cell)}
                      onPointerMove={handlePointerDragMove}
                      onPointerUp={handlePointerDragEnd}
                      onPointerCancel={handlePointerDragCancel}
                      onMouseEnter={() => setHoveredIndex(index)}
                      onMouseLeave={() => setHoveredIndex(null)}
                    >
                      <span className="preview-dropzone-label">
                        {activeResizePreview?.index === index
                          ? `${activeResizePreview.colSpan} × ${activeResizePreview.rowSpan}`
                          : 'Drag to move'}
                      </span>
                      {!allowTouchMove ? (
                        <>
                          <button
                            type="button"
                            className="preview-resize-handle preview-resize-handle-left"
                            aria-label="Resize from the left"
                            tabIndex={-1}
                            onPointerDown={(event) => handleResizeStart(event, cell, 'left')}
                            onPointerMove={handleResizeMove}
                            onPointerUp={handleResizeEnd}
                            onPointerCancel={handleResizeCancel}
                          />
                          <button
                            type="button"
                            className="preview-resize-handle preview-resize-handle-right"
                            aria-label="Resize from the right"
                            tabIndex={-1}
                            onPointerDown={(event) => handleResizeStart(event, cell, 'right')}
                            onPointerMove={handleResizeMove}
                            onPointerUp={handleResizeEnd}
                            onPointerCancel={handleResizeCancel}
                          />
                          <button
                            type="button"
                            className="preview-resize-handle preview-resize-handle-top"
                            aria-label="Resize from the top"
                            tabIndex={-1}
                            onPointerDown={(event) => handleResizeStart(event, cell, 'top')}
                            onPointerMove={handleResizeMove}
                            onPointerUp={handleResizeEnd}
                            onPointerCancel={handleResizeCancel}
                          />
                          <button
                            type="button"
                            className="preview-resize-handle preview-resize-handle-bottom"
                            aria-label="Resize from the bottom"
                            tabIndex={-1}
                            onPointerDown={(event) => handleResizeStart(event, cell, 'bottom')}
                            onPointerMove={handleResizeMove}
                            onPointerUp={handleResizeEnd}
                            onPointerCancel={handleResizeCancel}
                          />
                          <button
                            type="button"
                            className="preview-resize-handle preview-resize-handle-top-left"
                            aria-label="Resize from the top left"
                            tabIndex={-1}
                            onPointerDown={(event) => handleResizeStart(event, cell, 'top-left')}
                            onPointerMove={handleResizeMove}
                            onPointerUp={handleResizeEnd}
                            onPointerCancel={handleResizeCancel}
                          />
                          <button
                            type="button"
                            className="preview-resize-handle preview-resize-handle-top-right"
                            aria-label="Resize from the top right"
                            tabIndex={-1}
                            onPointerDown={(event) => handleResizeStart(event, cell, 'top-right')}
                            onPointerMove={handleResizeMove}
                            onPointerUp={handleResizeEnd}
                            onPointerCancel={handleResizeCancel}
                          />
                          <button
                            type="button"
                            className="preview-resize-handle preview-resize-handle-bottom-left"
                            aria-label="Resize from the bottom left"
                            tabIndex={-1}
                            onPointerDown={(event) => handleResizeStart(event, cell, 'bottom-left')}
                            onPointerMove={handleResizeMove}
                            onPointerUp={handleResizeEnd}
                            onPointerCancel={handleResizeCancel}
                          />
                          <button
                            type="button"
                            className="preview-resize-handle preview-resize-handle-bottom-right"
                            aria-label="Resize from the bottom right"
                            tabIndex={-1}
                            onPointerDown={(event) => handleResizeStart(event, cell, 'bottom-right')}
                            onPointerMove={handleResizeMove}
                            onPointerUp={handleResizeEnd}
                            onPointerCancel={handleResizeCancel}
                          />
                        </>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <div className="preview-placeholder">
              <p>{helperText ?? 'Add at least 2 photos to start your collage.'}</p>
            </div>
          )
        ) : (
          <div className="preview-placeholder">
            <p>Your collage preview will appear here once you add some photos.</p>
          </div>
        )}
      </div>

      {controlsSlot || (helperText && canBuild) ? (
        <div className="preview-controls-region">
          {controlsSlot}
          {helperText && canBuild ? (
            <div className="preview-footer">
              <div className="tip-note panel-description panel-description-tight" role="note">
                <span className="tip-note-icon" aria-hidden="true">
                  i
                </span>
                <p className="helper-text">{helperText}</p>
              </div>
              {exportFrameNote ? (
                <div className="tip-note preview-desktop-note" role="note">
                  <span className="tip-note-icon" aria-hidden="true">
                    i
                  </span>
                  <p className="helper-text">{exportFrameNote}</p>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
