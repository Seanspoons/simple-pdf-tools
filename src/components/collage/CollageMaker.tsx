import { useEffect, useMemo, useRef, useState } from 'react';
import { ConfirmModal } from '../ConfirmModal';
import { FloatingMessage } from '../FloatingMessage';
import {
  MAX_COLLAGE_COLUMNS,
  MAX_COLLAGE_IMAGES,
  COLLAGE_PRESETS_STORAGE_KEY,
  COLLAGE_SETTINGS_STORAGE_KEY
} from '../../constants';
import { CollageSavedPreset, CollageSettings, CollageTile, ImageAsset } from '../../types';
import {
  createDownloadFilename,
  exportCanvasToBlob,
  shareImageIfPossible,
  triggerDownload
} from '../../utils/exportImage';
import {
  clearCollageDraft,
  loadCollageDraft,
  saveCollageDraft
} from '../../utils/collage/draftStorage';
import { loadImageAsset } from '../../utils/imageLoader';
import {
  getCollageLayoutMetrics,
  getCollageOutputSize,
  getCollagePackedTiles,
  renderCollage
} from '../../utils/collage/renderCollage';
import { CollageControls } from './CollageControls';
import { CollagePreview } from './CollagePreview';
import { CollageUploadPanel } from './CollageUploadPanel';

type CollageConfirmAction = 'clear' | 'reset' | null;
type ResizeHandleMode =
  | 'left'
  | 'right'
  | 'top'
  | 'bottom'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right';
interface CollageHistoryEntry {
  settings: CollageSettings;
  tiles: CollageTile[];
}

const DEFAULT_COLLAGE_SETTINGS: CollageSettings = {
  shapePreset: 'square',
  qualityPreset: 'standard',
  columns: 3,
  gap: 12,
  backgroundColor: '#ffffff',
  fitMode: 'cover',
  cornerRadius: 0,
  exportFormat: 'jpeg'
};

function createCollageTile(image: ImageAsset): CollageTile {
  return {
    ...image,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    colSpan: 1,
    rowSpan: 1,
    gridColumn: null,
    gridRow: null
  };
}

function loadStoredCollagePresets(): CollageSavedPreset[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(COLLAGE_PRESETS_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    return JSON.parse(raw) as CollageSavedPreset[];
  } catch {
    return [];
  }
}

function loadStoredCollageSettings(): CollageSettings {
  if (typeof window === 'undefined') {
    return DEFAULT_COLLAGE_SETTINGS;
  }

  try {
    const raw = window.localStorage.getItem(COLLAGE_SETTINGS_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_COLLAGE_SETTINGS;
    }

    return { ...DEFAULT_COLLAGE_SETTINGS, ...JSON.parse(raw) } as CollageSettings;
  } catch {
    return DEFAULT_COLLAGE_SETTINGS;
  }
}

function getRecommendedColumns(imageCount: number): number {
  if (imageCount <= 4) {
    return 2;
  }

  if (imageCount <= 9) {
    return 3;
  }

  if (imageCount <= 16) {
    return 4;
  }

  if (imageCount <= 25) {
    return 5;
  }

  if (imageCount <= 36) {
    return 6;
  }

  return 7;
}

function getRecommendedSettings(
  imageCount: number,
  currentSettings: CollageSettings
): CollageSettings {
  const nextColumns = getRecommendedColumns(imageCount);
  const shouldUseHighRes = imageCount >= 10;

  return {
    ...currentSettings,
    columns: nextColumns,
    qualityPreset: shouldUseHighRes ? 'hd' : currentSettings.qualityPreset
  };
}

function cloneTiles(tiles: CollageTile[]) {
  return tiles.map((tile) => ({ ...tile }));
}

function tilesOverlap(
  aColumn: number,
  aRow: number,
  aColSpan: number,
  aRowSpan: number,
  bColumn: number,
  bRow: number,
  bColSpan: number,
  bRowSpan: number
) {
  return !(
    aColumn + aColSpan <= bColumn ||
    bColumn + bColSpan <= aColumn ||
    aRow + aRowSpan <= bRow ||
    bRow + bRowSpan <= aRow
  );
}

function createHistoryEntry(tiles: CollageTile[], settings: CollageSettings): CollageHistoryEntry {
  return {
    settings: { ...settings },
    tiles: cloneTiles(tiles)
  };
}

function getHistorySignature(entry: CollageHistoryEntry) {
  return JSON.stringify({
    settings: entry.settings,
    tiles: entry.tiles.map((tile) => ({
      id: tile.id,
      colSpan: tile.colSpan,
      rowSpan: tile.rowSpan,
      gridColumn: tile.gridColumn,
      gridRow: tile.gridRow
    }))
  });
}

export function CollageMaker() {
  const [tiles, setTiles] = useState<CollageTile[]>([]);
  const [resizePreview, setResizePreview] = useState<{
    index: number;
    colSpan: number;
    rowSpan: number;
    mode: ResizeHandleMode;
  } | null>(null);
  const [resizePreviewColumns, setResizePreviewColumns] = useState<number | null>(null);
  const [settings, setSettings] = useState<CollageSettings>(loadStoredCollageSettings);
  const [savedPresets, setSavedPresets] = useState<CollageSavedPreset[]>(loadStoredCollagePresets);
  const [presetName, setPresetName] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [hasLoadedDraft, setHasLoadedDraft] = useState(false);
  const [confirmAction, setConfirmAction] = useState<CollageConfirmAction>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(0);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const [canPreviewDrag, setCanPreviewDrag] = useState(false);
  const [canTouchPreviewMove, setCanTouchPreviewMove] = useState(false);
  const [historyPast, setHistoryPast] = useState<CollageHistoryEntry[]>([]);
  const [historyFuture, setHistoryFuture] = useState<CollageHistoryEntry[]>([]);
  const imagesRef = useRef<CollageTile[]>([]);
  const tilesStateRef = useRef<CollageTile[]>([]);
  const settingsStateRef = useRef<CollageSettings>(settings);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const exportPreviewCanvasRef = useRef<HTMLCanvasElement>(null);
  const exportCanvasRef = useRef<HTMLCanvasElement>(null);

  const imageSummary = useMemo(() => {
    if (tiles.length === 0) {
      return 'Add at least 2 photos to start building a collage.';
    }

    if (tiles.length === 1) {
      return 'Add one more photo to turn this into a collage.';
    }

    return `${tiles.length} photos ready for your collage.`;
  }, [tiles.length]);

  const canUndo = historyPast.length > 0;
  const canRedo = historyFuture.length > 0;

  const pushHistoryEntry = (nextTiles: CollageTile[], nextSettings: CollageSettings) => {
    const previousEntry = createHistoryEntry(tilesStateRef.current, settingsStateRef.current);
    const nextEntry = createHistoryEntry(nextTiles, nextSettings);
    if (getHistorySignature(previousEntry) === getHistorySignature(nextEntry)) {
      return;
    }

    setHistoryPast((current) => [...current.slice(-39), previousEntry]);
    setHistoryFuture([]);
  };

  const anchorTilesToPackedLayout = (
    currentTiles: CollageTile[],
    packedTiles: Array<{ id: string; column: number; row: number }>
  ) => {
    const packedById = new Map(
      packedTiles.map((tile) => [tile.id, { column: tile.column, row: tile.row }])
    );

    return currentTiles.map((tile) => {
      const packed = packedById.get(tile.id);
      return packed
        ? {
            ...tile,
            gridColumn: packed.column,
            gridRow: packed.row
          }
        : tile;
    });
  };

  const findNearestOpenPlacement = (
    tile: CollageTile,
    placedTiles: CollageTile[],
    preferredColumn: number,
    preferredRow: number
  ) => {
    const maxColumn = Math.max(0, MAX_COLLAGE_COLUMNS - tile.colSpan);
    const normalizedPreferredColumn = Math.max(0, Math.min(maxColumn, preferredColumn));
    const normalizedPreferredRow = Math.max(0, preferredRow);
    const maxOccupiedRow = placedTiles.reduce((maxRow, placedTile) => {
      if (placedTile.gridRow === null) {
        return maxRow;
      }

      return Math.max(maxRow, placedTile.gridRow + placedTile.rowSpan);
    }, normalizedPreferredRow);
    const maxSearchRow = Math.max(normalizedPreferredRow + 12, maxOccupiedRow + tile.rowSpan + 4);

    const candidateColumns: number[] = [];
    for (let offset = 0; offset <= MAX_COLLAGE_COLUMNS; offset += 1) {
      const left = normalizedPreferredColumn - offset;
      const right = normalizedPreferredColumn + offset;

      if (left >= 0 && left <= maxColumn && !candidateColumns.includes(left)) {
        candidateColumns.push(left);
      }

      if (right >= 0 && right <= maxColumn && !candidateColumns.includes(right)) {
        candidateColumns.push(right);
      }
    }

    const canFitPlacement = (column: number, row: number) =>
      placedTiles.every((placedTile) => {
        if (placedTile.gridColumn === null || placedTile.gridRow === null) {
          return true;
        }

        return !tilesOverlap(
          column,
          row,
          tile.colSpan,
          tile.rowSpan,
          placedTile.gridColumn,
          placedTile.gridRow,
          placedTile.colSpan,
          placedTile.rowSpan
        );
      });

    for (let rowOffset = 0; rowOffset <= maxSearchRow; rowOffset += 1) {
      const candidateRows =
        rowOffset === 0
          ? [normalizedPreferredRow]
          : [normalizedPreferredRow - rowOffset, normalizedPreferredRow + rowOffset].filter(
              (row, index, rows) => row >= 0 && rows.indexOf(row) === index
            );

      for (const row of candidateRows) {
        for (const column of candidateColumns) {
          if (canFitPlacement(column, row)) {
            return { column, row };
          }
        }
      }
    }

    return { column: normalizedPreferredColumn, row: maxSearchRow };
  };

  const resolveLocalTileCollisions = (anchoredTiles: CollageTile[], primaryIndex: number) => {
    const primaryTile = anchoredTiles[primaryIndex];
    if (!primaryTile || primaryTile.gridColumn === null || primaryTile.gridRow === null) {
      return anchoredTiles;
    }
    const primaryColumn = primaryTile.gridColumn;
    const primaryRow = primaryTile.gridRow;

    const impactedIndices = anchoredTiles
      .map((tile, index) => ({ tile, index }))
      .filter(({ tile, index }) => {
        if (
          index === primaryIndex ||
          tile.gridColumn === null ||
          tile.gridRow === null
        ) {
          return false;
        }

        return tilesOverlap(
          primaryColumn,
          primaryRow,
          primaryTile.colSpan,
          primaryTile.rowSpan,
          tile.gridColumn,
          tile.gridRow,
          tile.colSpan,
          tile.rowSpan
        );
      })
      .sort((a, b) => {
        const rowDelta = (a.tile.gridRow ?? 0) - (b.tile.gridRow ?? 0);
        if (rowDelta !== 0) {
          return rowDelta;
        }

        const columnDelta = (a.tile.gridColumn ?? 0) - (b.tile.gridColumn ?? 0);
        if (columnDelta !== 0) {
          return columnDelta;
        }

        return a.index - b.index;
      })
      .map(({ index }) => index);

    if (impactedIndices.length === 0) {
      return anchoredTiles;
    }

    const impactedIndexSet = new Set(impactedIndices);
    const nextTiles = anchoredTiles.map((tile) => ({ ...tile }));
    const placedTiles = nextTiles.filter(
      (_tile, index) => index === primaryIndex || !impactedIndexSet.has(index)
    );

    impactedIndices.forEach((index) => {
      const tile = nextTiles[index];
      const placement = findNearestOpenPlacement(
        tile,
        placedTiles,
        tile.gridColumn ?? 0,
        tile.gridRow ?? 0
      );

      tile.gridColumn = placement.column;
      tile.gridRow = placement.row;
      placedTiles.push(tile);
    });

    return nextTiles;
  };

  const canAreaFit = (
    occupiedCells: Set<string>,
    column: number,
    row: number,
    colSpan: number,
    rowSpan: number
  ) => {
    if (column < 0 || row < 0 || column + colSpan > MAX_COLLAGE_COLUMNS) {
      return false;
    }

    for (let rowOffset = 0; rowOffset < rowSpan; rowOffset += 1) {
      for (let columnOffset = 0; columnOffset < colSpan; columnOffset += 1) {
        if (occupiedCells.has(`${column + columnOffset}:${row + rowOffset}`)) {
          return false;
        }
      }
    }

    return true;
  };

  const canBuildCollage = tiles.length >= 2;
  const previewSize = useMemo(() => {
    const outputSize = getCollageOutputSize(settings);
    const maxPreviewWidth = 960;
    const scale = Math.min(maxPreviewWidth / outputSize.width, 1);
    const dpr =
      typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio || 1, 2);

    return {
      width: Math.round(outputSize.width * scale * dpr),
      height: Math.round(outputSize.height * scale * dpr)
    };
  }, [settings]);
  const currentPackedTiles = useMemo(
    () => getCollagePackedTiles(tiles, settings, previewSize),
    [previewSize, settings, tiles]
  );
  const previewTiles = useMemo(() => {
    if (!resizePreview) {
      return tiles;
    }

    const anchoredTiles = anchorTilesToPackedLayout(tiles, currentPackedTiles);
    const currentPlacement = currentPackedTiles.find((tile) => tile.index === resizePreview.index);
    if (!currentPlacement) {
      return anchoredTiles.map((tile, index) =>
        index === resizePreview.index
          ? {
              ...tile,
              colSpan: resizePreview.colSpan,
              rowSpan: resizePreview.rowSpan
            }
          : tile
      );
    }

    const occupiedCells = new Set<string>();
    currentPackedTiles.forEach((tile) => {
      if (tile.index === resizePreview.index) {
        return;
      }

      for (let rowOffset = 0; rowOffset < tile.rowSpan; rowOffset += 1) {
        for (let columnOffset = 0; columnOffset < tile.colSpan; columnOffset += 1) {
          occupiedCells.add(`${tile.column + columnOffset}:${tile.row + rowOffset}`);
        }
      }
    });

    let nextColumn = currentPlacement.column;
    let nextRow = currentPlacement.row;
    let workingColSpan = currentPlacement.colSpan;
    let workingRowSpan = currentPlacement.rowSpan;
    const prefersLeft = resizePreview.mode.includes('left');
    const prefersRight = resizePreview.mode.includes('right');
    const prefersTop = resizePreview.mode.includes('top');
    const prefersBottom = resizePreview.mode.includes('bottom');

    if (resizePreview.colSpan < currentPlacement.colSpan && prefersLeft) {
      nextColumn += currentPlacement.colSpan - resizePreview.colSpan;
      workingColSpan = resizePreview.colSpan;
    }

    if (resizePreview.rowSpan < currentPlacement.rowSpan && prefersTop) {
      nextRow += currentPlacement.rowSpan - resizePreview.rowSpan;
      workingRowSpan = resizePreview.rowSpan;
    }

    while (workingColSpan < resizePreview.colSpan) {
      const canGrowLeft = canAreaFit(
        occupiedCells,
        nextColumn - 1,
        nextRow,
        workingColSpan + 1,
        workingRowSpan
      );
      const canGrowRight = canAreaFit(
        occupiedCells,
        nextColumn,
        nextRow,
        workingColSpan + 1,
        workingRowSpan
      );

      if (prefersLeft && canGrowLeft) {
        nextColumn -= 1;
      } else if (prefersRight && canGrowRight) {
        // Keep the current anchor and grow rightward.
      } else if (canGrowLeft && !canGrowRight) {
        nextColumn -= 1;
      } else if (!canGrowLeft && !canGrowRight) {
        break;
      }

      workingColSpan += 1;
    }

    while (workingRowSpan < resizePreview.rowSpan) {
      const canGrowUp = canAreaFit(
        occupiedCells,
        nextColumn,
        nextRow - 1,
        workingColSpan,
        workingRowSpan + 1
      );
      const canGrowDown = canAreaFit(
        occupiedCells,
        nextColumn,
        nextRow,
        workingColSpan,
        workingRowSpan + 1
      );

      if (prefersTop && canGrowUp) {
        nextRow -= 1;
      } else if (prefersBottom && canGrowDown) {
        // Keep the current anchor and grow downward.
      } else if (canGrowUp && !canGrowDown) {
        nextRow -= 1;
      } else if (!canGrowUp && !canGrowDown) {
        break;
      }

      workingRowSpan += 1;
    }

    const nextTiles = anchoredTiles.map((tile, index) =>
      index === resizePreview.index
        ? {
            ...tile,
            gridColumn: nextColumn,
            gridRow: nextRow,
            colSpan: resizePreview.colSpan,
            rowSpan: resizePreview.rowSpan
          }
        : tile
    );

    return resolveLocalTileCollisions(nextTiles, resizePreview.index);
  }, [currentPackedTiles, resizePreview, tiles]);
  const packedPreviewTiles = useMemo(
    () =>
      getCollagePackedTiles(
        previewTiles,
        settings,
        previewSize,
        resizePreviewColumns ?? undefined
      ),
    [previewTiles, previewSize, resizePreviewColumns, settings]
  );
  const layoutMetrics = useMemo(() => getCollageLayoutMetrics(tiles, settings), [tiles, settings]);
  const previewMetrics = useMemo(
    () =>
      getCollageLayoutMetrics(
        previewTiles,
        settings,
        previewSize,
        resizePreviewColumns ?? undefined
      ),
    [previewTiles, previewSize, resizePreviewColumns, settings]
  );
  const layoutAdvice = useMemo(() => {
    if (!canBuildCollage) {
      return { message: null, actions: [] as Array<{ label: string; apply: () => void }> };
    }

    if (layoutMetrics.cellSize < 150) {
      return {
        message:
          'This layout will make each photo quite small. Try fewer columns, less spacing, or a higher quality export.',
        actions: [
          {
            label: 'Use fewer columns',
            apply: () =>
              setSettings((current) => ({
                ...current,
                columns: Math.max(2, current.columns - 1)
              }))
          },
          {
            label: 'Use HD',
            apply: () =>
              setSettings((current) => ({
                ...current,
                qualityPreset: 'hd'
              }))
          }
        ]
      };
    }

    return { message: null, actions: [] as Array<{ label: string; apply: () => void }> };
  }, [canBuildCollage, layoutMetrics]);
  const previewHelperText = canPreviewDrag
    ? 'Drag a tile to reorder it. Drag a handle to make it bigger or smaller.'
    : canTouchPreviewMove
      ? 'Drag a tile in the preview to move it. Use the width and height sliders below the preview to resize it.'
      : 'Use the controls below the preview to resize a selected tile.';

  useEffect(() => {
    setCanNativeShare('share' in navigator && 'canShare' in navigator);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !('matchMedia' in window)) {
      return;
    }

    const desktopMediaQuery = window.matchMedia('(min-width: 921px) and (pointer: fine)');
    const touchMediaQuery = window.matchMedia('(pointer: coarse)');
    const updateInteractivePreview = () => {
      setCanPreviewDrag(desktopMediaQuery.matches);
      setCanTouchPreviewMove(touchMediaQuery.matches);
    };
    updateInteractivePreview();
    desktopMediaQuery.addEventListener('change', updateInteractivePreview);
    touchMediaQuery.addEventListener('change', updateInteractivePreview);

    return () => {
      desktopMediaQuery.removeEventListener('change', updateInteractivePreview);
      touchMediaQuery.removeEventListener('change', updateInteractivePreview);
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem(COLLAGE_PRESETS_STORAGE_KEY, JSON.stringify(savedPresets));
  }, [savedPresets]);

  useEffect(() => {
    window.localStorage.setItem(COLLAGE_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    tilesStateRef.current = tiles;
    settingsStateRef.current = settings;
  }, [settings, tiles]);

  useEffect(() => {
    let isCancelled = false;

    async function restoreDraft() {
      try {
        const draft = await loadCollageDraft();
        if (!draft || isCancelled) {
          setHasLoadedDraft(true);
          return;
        }

        const restoredImages = await Promise.all(draft.files.map((file) => loadImageAsset(file)));
        if (isCancelled) {
          restoredImages.forEach((image) => URL.revokeObjectURL(image.objectUrl));
          return;
        }

        const restoredTiles = restoredImages.map((image, index) => {
          const storedTile = draft.tileStates[index];
          return {
            ...createCollageTile(image),
            id: storedTile?.id ?? `${Date.now()}-${index}`,
            colSpan: storedTile?.colSpan ?? 1,
            rowSpan: storedTile?.rowSpan ?? 1,
            gridColumn: storedTile?.gridColumn ?? null,
            gridRow: storedTile?.gridRow ?? null
          };
        });

        setSettings(draft.settings);
        setTiles(restoredTiles);
        setHistoryPast([]);
        setHistoryFuture([]);
        setStatusMessage(restoredTiles.length > 0 ? 'Restored your last collage.' : null);
      } catch {
        if (!isCancelled) {
          setErrorMessage('Your last collage could not be restored.');
        }
      } finally {
        if (!isCancelled) {
          setHasLoadedDraft(true);
        }
      }
    }

    void restoreDraft();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!canBuildCollage || !previewCanvasRef.current) {
      return;
    }

    renderCollage(previewCanvasRef.current, previewTiles, settings, {
      width: previewSize.width,
      height: previewSize.height
    });
  }, [canBuildCollage, previewSize.height, previewSize.width, previewTiles, settings]);

  useEffect(() => {
    if (!canBuildCollage || !exportPreviewCanvasRef.current) {
      return;
    }

    renderCollage(exportPreviewCanvasRef.current, tiles, settings, {
      width: previewSize.width,
      height: previewSize.height
    });
  }, [canBuildCollage, previewSize.height, previewSize.width, settings, tiles]);

  useEffect(() => {
    imagesRef.current = tiles;
  }, [tiles]);

  useEffect(() => {
    setSelectedImageIndex((current) => {
      if (tiles.length === 0) {
        return null;
      }

      if (current === null) {
        return null;
      }

      return Math.min(current, tiles.length - 1);
    });
  }, [tiles.length]);

  useEffect(() => {
    if (!hasLoadedDraft) {
      return;
    }

    void saveCollageDraft(
      settings,
      tiles.map((tile) => tile.file),
      tiles.map((tile) => ({
        id: tile.id,
        colSpan: tile.colSpan,
        rowSpan: tile.rowSpan,
        gridColumn: tile.gridColumn,
        gridRow: tile.gridRow
      }))
    );
  }, [hasLoadedDraft, settings, tiles]);

  useEffect(() => {
    return () => {
      imagesRef.current.forEach((image) => URL.revokeObjectURL(image.objectUrl));
    };
  }, []);

  const handleFilesSelect = async (selectedFiles: FileList | File[]) => {
    const nextFiles = Array.from(selectedFiles);
    const roomRemaining = MAX_COLLAGE_IMAGES - tiles.length;

    if (roomRemaining <= 0) {
      setErrorMessage(`You can add up to ${MAX_COLLAGE_IMAGES} photos in one collage.`);
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);
    setStatusMessage('Adding photos...');

    try {
      const filesToLoad = nextFiles.slice(0, roomRemaining);
      const loadedImages = await Promise.all(filesToLoad.map((file) => loadImageAsset(file)));
      const nextImageCount = tiles.length + loadedImages.length;
      const loadedTiles = loadedImages.map((image) => createCollageTile(image));
      const nextTiles = [...tilesStateRef.current, ...loadedTiles];
      const nextSettings = getRecommendedSettings(nextImageCount, settingsStateRef.current);
      pushHistoryEntry(nextTiles, nextSettings);
      setTiles(nextTiles);
      setSettings(nextSettings);
      setStatusMessage(`${nextImageCount} photos ready.`);

      if (nextFiles.length > roomRemaining) {
        setErrorMessage(`Only the first ${roomRemaining} additional photos were added.`);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Some photos could not be loaded.');
      setStatusMessage(null);
    } finally {
      setIsBusy(false);
    }
  };

  const handleSettingsChange = <K extends keyof CollageSettings>(
    key: K,
    value: CollageSettings[K]
  ) => {
    if (key === 'columns') {
      const nextColumns = value as number;
      const anchoredTiles = anchorTilesToCurrentLayout(tiles);
      const compactedTiles = anchoredTiles.map((tile) => {
        if (tile.gridColumn === null || tile.gridRow === null) {
          return tile;
        }

        if (tile.gridColumn + tile.colSpan <= nextColumns) {
          return tile;
        }

        return {
          ...tile,
          gridColumn: null,
          gridRow: null
        };
      });

      const isSquareOutput = settings.shapePreset === 'square';
      if (isSquareOutput && nextColumns < settings.columns) {
        const nextMetrics = getCollageLayoutMetrics(compactedTiles, { ...settings, columns: nextColumns });
        if (nextMetrics.rows > nextColumns) {
          setStatusMessage(`This collage cannot fit into a ${nextColumns} × ${nextColumns} square yet.`);
          return;
        }
      }

      const shouldUseHigherQuality =
        nextColumns >= 5 && settingsStateRef.current.qualityPreset === 'standard';
      const nextSettings = {
        ...settingsStateRef.current,
        [key]: value,
        qualityPreset: shouldUseHigherQuality ? 'hd' : settingsStateRef.current.qualityPreset
      };
      pushHistoryEntry(compactedTiles, nextSettings);
      setTiles(compactedTiles);
      setSettings(nextSettings);
      setStatusMessage(
        shouldUseHigherQuality
          ? `Set the grid to ${nextColumns} columns and switched to HD for sharper tiles.`
          : `Set the grid to ${nextColumns} columns.`
      );
      return;
    }

    if (key === 'qualityPreset' && value === 'standard' && settings.columns >= 5) {
      const nextSettings = { ...settingsStateRef.current, qualityPreset: 'hd' as const };
      pushHistoryEntry(tilesStateRef.current, nextSettings);
      setSettings(nextSettings);
      setStatusMessage('HD stays on for dense collages so the tiles stay sharp.');
      return;
    }

    const nextSettings = { ...settingsStateRef.current, [key]: value };
    pushHistoryEntry(tilesStateRef.current, nextSettings);
    setSettings(nextSettings);
  };

  const handleAutoArrange = () => {
    if (tiles.length === 0) {
      setStatusMessage('Add photos first, then Auto arrange can help.');
      return;
    }

    const nextSettings = getRecommendedSettings(tiles.length, settingsStateRef.current);
    pushHistoryEntry(tilesStateRef.current, nextSettings);
    setSettings(nextSettings);
    setStatusMessage('Applied a suggested layout.');
  };

  const handleReset = () => {
    pushHistoryEntry(tilesStateRef.current, DEFAULT_COLLAGE_SETTINGS);
    setSettings(DEFAULT_COLLAGE_SETTINGS);
    setStatusMessage('Collage settings reset.');
  };

  const handleSavePreset = () => {
    const trimmedName = presetName.trim();
    if (!trimmedName) {
      setErrorMessage('Add a name before saving this collage look.');
      return;
    }

    const nextPreset: CollageSavedPreset = {
      id: `collage-preset-${Date.now()}`,
      name: trimmedName,
      settings
    };

    setSavedPresets((current) => [...current, nextPreset]);
    setPresetName('');
    setErrorMessage(null);
    setStatusMessage(`Saved "${trimmedName}".`);
  };

  const handleApplyPreset = (presetId: string) => {
    const preset = savedPresets.find((entry) => entry.id === presetId);
    if (!preset) {
      return;
    }

    setSettings(preset.settings);
    setErrorMessage(null);
    setStatusMessage(`Applied "${preset.name}".`);
  };

  const handleDeletePreset = (presetId: string) => {
    const preset = savedPresets.find((entry) => entry.id === presetId);
    if (!preset) {
      return;
    }

    setSavedPresets((current) => current.filter((entry) => entry.id !== presetId));
    setErrorMessage(null);
    setStatusMessage(`Removed "${preset.name}".`);
  };

  const handleClearPhotos = () => {
    setTiles((current) => {
      current.forEach((tile) => URL.revokeObjectURL(tile.objectUrl));
      return [];
    });
    void clearCollageDraft();
    setHistoryPast([]);
    setHistoryFuture([]);
    setErrorMessage(null);
    setStatusMessage('Ready for a new collage.');
    setSelectedImageIndex(null);
    setConfirmAction(null);
  };

  const handleConfirmReset = () => {
    handleReset();
    setConfirmAction(null);
  };

  const handleRemoveImage = (index: number) => {
    const nextTiles = [...tilesStateRef.current];
    nextTiles.splice(index, 1);
    pushHistoryEntry(nextTiles, settingsStateRef.current);
    setTiles(nextTiles);
    setSelectedImageIndex((current) => {
      if (current === null) {
        return null;
      }

      return Math.max(0, Math.min(current, tiles.length - 2));
    });
    setStatusMessage('Photo removed.');
  };

  const getResizeAnchor = (
    index: number,
    nextColSpan: number,
    nextRowSpan: number,
    anchoredTiles: CollageTile[],
    mode: ResizeHandleMode = 'bottom-right'
  ) => {
    const currentPlacement = packedPreviewTiles.find((tile) => tile.index === index);
    if (!currentPlacement) {
      return null;
    }

    const occupiedCells = new Set<string>();
    packedPreviewTiles.forEach((tile) => {
      if (tile.index === index) {
        return;
      }

      for (let rowOffset = 0; rowOffset < tile.rowSpan; rowOffset += 1) {
        for (let columnOffset = 0; columnOffset < tile.colSpan; columnOffset += 1) {
          occupiedCells.add(`${tile.column + columnOffset}:${tile.row + rowOffset}`);
        }
      }
    });

    let nextColumn = currentPlacement.column;
    let nextRow = currentPlacement.row;
    let workingColSpan = currentPlacement.colSpan;
    let workingRowSpan = currentPlacement.rowSpan;
    const prefersLeft = mode.includes('left');
    const prefersRight = mode.includes('right');
    const prefersTop = mode.includes('top');
    const prefersBottom = mode.includes('bottom');

    if (nextColSpan < currentPlacement.colSpan && prefersLeft) {
      nextColumn += currentPlacement.colSpan - nextColSpan;
      workingColSpan = nextColSpan;
    }

    if (nextRowSpan < currentPlacement.rowSpan && prefersTop) {
      nextRow += currentPlacement.rowSpan - nextRowSpan;
      workingRowSpan = nextRowSpan;
    }

    while (workingColSpan < nextColSpan) {
      const canGrowLeft = canAreaFit(
        occupiedCells,
        nextColumn - 1,
        nextRow,
        workingColSpan + 1,
        workingRowSpan
      );
      const canGrowRight = canAreaFit(
        occupiedCells,
        nextColumn,
        nextRow,
        workingColSpan + 1,
        workingRowSpan
      );

      if (prefersLeft && canGrowLeft) {
        nextColumn -= 1;
      } else if (prefersRight && canGrowRight) {
        // Keep the current anchor and grow outward to the right.
      } else if (canGrowLeft && !canGrowRight) {
        nextColumn -= 1;
      } else if (!canGrowLeft && !canGrowRight) {
        break;
      }

      workingColSpan += 1;
    }

    while (workingRowSpan < nextRowSpan) {
      const canGrowUp = canAreaFit(
        occupiedCells,
        nextColumn,
        nextRow - 1,
        workingColSpan,
        workingRowSpan + 1
      );
      const canGrowDown = canAreaFit(
        occupiedCells,
        nextColumn,
        nextRow,
        workingColSpan,
        workingRowSpan + 1
      );

      if (prefersTop && canGrowUp) {
        nextRow -= 1;
      } else if (prefersBottom && canGrowDown) {
        // Keep the current anchor and grow downward.
      } else if (canGrowUp && !canGrowDown) {
        nextRow -= 1;
      } else if (!canGrowUp && !canGrowDown) {
        break;
      }

      workingRowSpan += 1;
    }

    const tile = anchoredTiles[index];
    if (!tile) {
      return null;
    }

    return {
      ...tile,
      gridColumn: nextColumn,
      gridRow: nextRow,
      colSpan: nextColSpan,
      rowSpan: nextRowSpan
    };
  };

  const handleResizeTile = (
    index: number,
    colSpan: number,
    rowSpan: number,
    mode: ResizeHandleMode = 'bottom-right'
  ) => {
    const anchoredTiles = anchorTilesToCurrentLayout(tilesStateRef.current);
    const resizedTile = getResizeAnchor(index, colSpan, rowSpan, anchoredTiles, mode);
    const nextTiles = anchoredTiles.map((tile, currentIndex) =>
      currentIndex === index
        ? resizedTile ?? {
            ...tile,
            colSpan,
            rowSpan
          }
        : tile
    );
    const stabilizedTiles = resolveLocalTileCollisions(nextTiles, index);
    let nextSettings = settingsStateRef.current;

    if (settingsStateRef.current.shapePreset === 'square') {
      let resolvedColumns: number | null = null;

      for (
        let candidateColumns = Math.max(settingsStateRef.current.columns, colSpan);
        candidateColumns <= MAX_COLLAGE_COLUMNS;
        candidateColumns += 1
      ) {
        const candidateMetrics = getCollageLayoutMetrics(stabilizedTiles, {
          ...settingsStateRef.current,
          columns: candidateColumns
        });

        if (candidateMetrics.rows <= candidateColumns) {
          resolvedColumns = candidateColumns;
          break;
        }
      }

      if (resolvedColumns === null) {
        setStatusMessage(
          `This tile cannot grow to ${colSpan} × ${rowSpan} while keeping the collage square.`
        );
        return;
      }

      const shouldUseHigherQuality =
        resolvedColumns >= 5 && settingsStateRef.current.qualityPreset === 'standard';
      nextSettings = {
        ...settingsStateRef.current,
        columns: resolvedColumns,
        qualityPreset: shouldUseHigherQuality ? 'hd' : settingsStateRef.current.qualityPreset
      };

      if (resolvedColumns > settingsStateRef.current.columns) {
        setStatusMessage(
          shouldUseHigherQuality
            ? `Tile resized to ${colSpan} × ${rowSpan}. The square grid grew to ${resolvedColumns} columns and switched to HD.`
            : `Tile resized to ${colSpan} × ${rowSpan}. The square grid grew to ${resolvedColumns} columns.`
        );
      } else {
        setStatusMessage(`Tile resized to ${colSpan} × ${rowSpan}.`);
      }
    } else {
      setStatusMessage(`Tile resized to ${colSpan} × ${rowSpan}.`);
    }

    pushHistoryEntry(stabilizedTiles, nextSettings);
    setSettings(nextSettings);
    setTiles(stabilizedTiles);
  };

  const handleResizePreview = (
    index: number,
    colSpan: number,
    rowSpan: number,
    mode: ResizeHandleMode
  ) => {
    const previewTile = packedPreviewTiles.find((tile) => tile.index === index);
    const requestedColumns = previewTile ? previewTile.column + colSpan : previewMetrics.columns;
    const requiredColumns = Math.min(MAX_COLLAGE_COLUMNS, requestedColumns);

    setResizePreviewColumns(requiredColumns);
    setResizePreview({ index, colSpan, rowSpan, mode });
  };

  const handleResizeCommit = (
    index: number,
    colSpan: number,
    rowSpan: number,
    mode: ResizeHandleMode
  ) => {
    const previewTile = packedPreviewTiles.find((tile) => tile.index === index);
    const requestedColumns = previewTile ? previewTile.column + colSpan : settingsStateRef.current.columns;
    const nextColumns = Math.max(
      settingsStateRef.current.columns,
      Math.min(MAX_COLLAGE_COLUMNS, requestedColumns)
    );
    const hitMaxColumns = requestedColumns > MAX_COLLAGE_COLUMNS;
    setResizePreview(null);
    setResizePreviewColumns(null);
    const anchoredTiles = anchorTilesToCurrentLayout(tilesStateRef.current);
    const resizedTile = getResizeAnchor(index, colSpan, rowSpan, anchoredTiles, mode);
    const nextTiles = anchoredTiles.map((tile, currentIndex) =>
      currentIndex === index
        ? resizedTile ?? {
            ...tile,
            colSpan,
            rowSpan
          }
        : tile
    );
    const stabilizedTiles = resolveLocalTileCollisions(nextTiles, index);
    const nextSettings = {
      ...settingsStateRef.current,
      columns: Math.max(settingsStateRef.current.columns, nextColumns)
    };
    pushHistoryEntry(stabilizedTiles, nextSettings);
    setSettings(nextSettings);
    setTiles(stabilizedTiles);
    setStatusMessage(
      hitMaxColumns
        ? `Tile resized to ${colSpan} × ${rowSpan}. Reached the max grid width of ${MAX_COLLAGE_COLUMNS} columns.`
        : `Tile resized to ${colSpan} × ${rowSpan}.`
    );
  };

  const handleResizeCancel = () => {
    setResizePreview(null);
    setResizePreviewColumns(null);
  };

  const renderSelectedTileActions = (compact = false) => {
    if (selectedImageIndex === null || !tiles[selectedImageIndex]) {
      return null;
    }

    const selectedTile = tiles[selectedImageIndex];

    return (
      <div
        className={`mobile-photo-toolbar collage-arrange-toolbar ${
          compact ? 'preview-mobile-toolbar' : ''
        }`}
        aria-live="polite"
      >
        <p className="mobile-photo-toolbar-title">{selectedTile.name}</p>
        <p className="helper-text">
          Current size: {selectedTile.colSpan} × {selectedTile.rowSpan}
        </p>
        <div className="arrange-slider-grid">
          <label className="field">
            <span>Width ({selectedTile.colSpan})</span>
            <input
              type="range"
              min="1"
              max={String(MAX_COLLAGE_COLUMNS)}
              step="1"
              value={selectedTile.colSpan}
              onChange={(event) =>
                handleResizeTile(selectedImageIndex, Number(event.target.value), selectedTile.rowSpan)
              }
              disabled={isBusy}
            />
          </label>
          <label className="field">
            <span>Height ({selectedTile.rowSpan})</span>
            <input
              type="range"
              min="1"
              max="8"
              step="1"
              value={selectedTile.rowSpan}
              onChange={(event) =>
                handleResizeTile(selectedImageIndex, selectedTile.colSpan, Number(event.target.value))
              }
              disabled={isBusy}
            />
          </label>
        </div>
        {!compact ? (
          <button
            type="button"
            className="thumb-inline-button is-danger"
            onClick={() => handleRemoveImage(selectedImageIndex)}
            disabled={isBusy}
          >
            Remove Photo
          </button>
        ) : null}
      </div>
    );
  };

  const anchorTilesToCurrentLayout = (currentTiles: CollageTile[]) => {
    return anchorTilesToPackedLayout(currentTiles, packedPreviewTiles);
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
    setDropTargetIndex(index);
    setSelectedImageIndex(index);
  };

  const handleDragEnter = (index: number) => {
    if (draggedIndex === null || draggedIndex === index) {
      return;
    }

    setDropTargetIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDropTargetIndex(null);
    if (canPreviewDrag) {
      setSelectedImageIndex(null);
    }
  };

  const moveTileToAnchor = (index: number, column: number, row: number) => {
    const anchoredTiles = anchorTilesToCurrentLayout(tilesStateRef.current);
    const movingTile = anchoredTiles[index];
    if (!movingTile) {
      handleDragEnd();
      return;
    }

    const nextColumn = Math.max(
      0,
      Math.min(MAX_COLLAGE_COLUMNS - movingTile.colSpan, column)
    );
    const nextRow = Math.max(0, row);
    const nextTiles = anchoredTiles.map((tile, tileIndex) => {
      if (tileIndex === index) {
        return {
          ...tile,
          gridColumn: nextColumn,
          gridRow: nextRow
        };
      }

      return tile;
    });
    const stabilizedTiles = resolveLocalTileCollisions(nextTiles, index);
    const nextSettings = {
      ...settingsStateRef.current,
      columns: Math.max(
        settingsStateRef.current.columns,
        Math.min(MAX_COLLAGE_COLUMNS, nextColumn + movingTile.colSpan)
      )
    };
    pushHistoryEntry(stabilizedTiles, nextSettings);
    setTiles(stabilizedTiles);
    setSettings(nextSettings);
    setSelectedImageIndex(index);
    setStatusMessage('Photo moved.');
    handleDragEnd();
  };

  const handleExport = async (format: 'jpeg' | 'png', action: 'download' | 'share') => {
    if (!canBuildCollage || !exportCanvasRef.current) {
      setErrorMessage('Add at least 2 photos before saving.');
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);
    setStatusMessage('Getting your collage ready...');

    try {
      renderCollage(exportCanvasRef.current, tiles, settings);
      const blob = await exportCanvasToBlob(exportCanvasRef.current, format, 0.94);
      const filename = createDownloadFilename('collage', format).replace('-watermarked', '');

      if (action === 'share') {
        const shared = await shareImageIfPossible(blob, filename);
        if (shared) {
          setStatusMessage('Collage ready to save or share.');
          return;
        }
      }

      triggerDownload(blob, filename);
      setStatusMessage(`${filename} is ready.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'The collage could not be exported.');
      setStatusMessage(null);
    } finally {
      setIsBusy(false);
    }
  };

  const handleUndo = () => {
    const previousEntry = historyPast[historyPast.length - 1];
    if (!previousEntry) {
      return;
    }

    const currentEntry = createHistoryEntry(tilesStateRef.current, settingsStateRef.current);
    setHistoryPast((current) => current.slice(0, -1));
    setHistoryFuture((current) => [currentEntry, ...current].slice(0, 40));
    setTiles(cloneTiles(previousEntry.tiles));
    setSettings({ ...previousEntry.settings });
    setStatusMessage('Undid the last collage change.');
  };

  const handleRedo = () => {
    const nextEntry = historyFuture[0];
    if (!nextEntry) {
      return;
    }

    const currentEntry = createHistoryEntry(tilesStateRef.current, settingsStateRef.current);
    setHistoryFuture((current) => current.slice(1));
    setHistoryPast((current) => [...current.slice(-39), currentEntry]);
    setTiles(cloneTiles(nextEntry.tiles));
    setSettings({ ...nextEntry.settings });
    setStatusMessage('Redid the collage change.');
  };

  const arrangeHeaderActions = (
    <div className="arrange-header-actions">
      {selectedImageIndex !== null && tiles[selectedImageIndex] ? (
        <span className="arrange-selected-chip" aria-live="polite">
          Selected: {tiles[selectedImageIndex].name}
        </span>
      ) : null}
      <button
        type="button"
        className="ghost-button"
        onClick={handleUndo}
        disabled={!canUndo || isBusy}
      >
        Undo
      </button>
      <button
        type="button"
        className="ghost-button"
        onClick={handleRedo}
        disabled={!canRedo || isBusy}
      >
        Redo
      </button>
      {selectedImageIndex !== null && tiles[selectedImageIndex] ? (
        <button
          type="button"
          className="ghost-button is-danger"
          onClick={() => handleRemoveImage(selectedImageIndex)}
          disabled={isBusy}
        >
          Remove
        </button>
      ) : null}
    </div>
  );

  return (
    <>
      <section className="hero">
        <div className="hero-copy-block">
          <div>
            <p className="eyebrow">Collage Maker</p>
            <h1>Build a simple collage from your photos.</h1>
            <p className="hero-copy">
              Add your photos, arrange them right in the preview, and save a clean collage at
              high quality right in your browser.
            </p>
            <div className="hero-tags" aria-label="Collage maker highlights">
              <span className="hero-tag">Photo collage</span>
              <span className="hero-tag">Drag to arrange</span>
              <span className="hero-tag">Private in browser</span>
            </div>
          </div>
        </div>
        <div className="hero-card">
          <p className="hero-stat-label">Your collage</p>
          <p className="hero-stat">{imageSummary}</p>
          <div className="tip-note" role="note">
            <span className="tip-note-icon" aria-hidden="true">
              i
            </span>
            <p className="helper-text">
              Add 2 to {MAX_COLLAGE_IMAGES} photos. Start with simple tiles, then resize any photo
              directly in the preview.
            </p>
          </div>
        </div>
      </section>

      {errorMessage || statusMessage ? (
        <div className="floating-message-stack">
          {errorMessage ? (
            <FloatingMessage
              tone="error"
              message={errorMessage}
              onDismiss={() => setErrorMessage(null)}
            />
          ) : null}
          {statusMessage ? (
            <FloatingMessage
              tone="status"
              message={statusMessage}
              onDismiss={() => setStatusMessage(null)}
            />
          ) : null}
        </div>
      ) : null}

      <section className="layout-grid collage-layout-grid">
        <div className="left-column">
          <div className="collage-mobile-step collage-mobile-step-upload">
            <CollageUploadPanel
              onFilesSelect={handleFilesSelect}
              disabled={isBusy}
              imageCount={tiles.length}
            />
          </div>
          <div className="collage-mobile-step collage-mobile-step-arrange">
            <div className="preview-sticky-wrap">
              <CollagePreview
                stepLabel="Step 3"
                title="Arrange"
                panelClassName="collage-arrange-panel"
                canvasRef={previewCanvasRef}
                hasImages={tiles.length > 0}
                imageCount={tiles.length}
                canBuild={canBuildCollage}
                helperText={previewHelperText}
                headerActionsSlot={canBuildCollage ? arrangeHeaderActions : null}
                previewCells={packedPreviewTiles}
                previewMetrics={previewMetrics}
                gap={settings.gap}
                backgroundColor={settings.backgroundColor}
                previewCornerRadius={settings.fitMode === 'cover' ? settings.cornerRadius : 0}
                previewImageUrls={tiles.map((tile) => tile.objectUrl)}
                controlsSlot={
                  canTouchPreviewMove && selectedImageIndex !== null
                    ? renderSelectedTileActions(true)
                    : null
                }
                isInteractive={(canPreviewDrag || canTouchPreviewMove) && canBuildCollage && !isBusy}
                allowTouchMove={canTouchPreviewMove && canBuildCollage && !isBusy}
                selectedIndex={selectedImageIndex ?? undefined}
                draggedIndex={draggedIndex}
                dropTargetIndex={dropTargetIndex}
                onTileSelect={setSelectedImageIndex}
                onTileDragStart={handleDragStart}
                onTileDragEnter={handleDragEnter}
                onTileDropAt={(index, column, row) => {
                  moveTileToAnchor(index, column, row);
                }}
                onTileDragEnd={handleDragEnd}
                onTileResizePreview={handleResizePreview}
                onTileResizeCommit={handleResizeCommit}
                onTileResizeCancel={handleResizeCancel}
              />
            </div>
          </div>
        </div>

        <div className="right-column">
          <div className="collage-mobile-step collage-mobile-step-controls">
            <CollageControls
              settings={settings}
              presetName={presetName}
              savedPresets={savedPresets}
              canUndo={canUndo}
              canRedo={canRedo}
              layoutWarning={layoutAdvice.message}
              warningActions={layoutAdvice.actions.map((action) => ({
                label: action.label,
                onClick: () => {
                  action.apply();
                  setStatusMessage(`${action.label} applied.`);
                }
              }))}
              disabled={isBusy}
              onPresetNameChange={setPresetName}
              onSavePreset={handleSavePreset}
              onApplyPreset={handleApplyPreset}
              onDeletePreset={handleDeletePreset}
              onAutoArrange={handleAutoArrange}
              onUndo={handleUndo}
              onRedo={handleRedo}
              onChange={handleSettingsChange}
              onReset={() => setConfirmAction('reset')}
            />
          </div>

          <div className="collage-mobile-step collage-mobile-step-export">
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Step 4</p>
                  <h2>Export</h2>
                </div>
              </div>
              {canBuildCollage ? (
                <div className="export-preview-block">
                  <p className="helper-text export-preview-label">Preview</p>
                  <div className="preview-shell collage-preview-shell export-preview-shell">
                    <canvas
                      ref={exportPreviewCanvasRef}
                      className="preview-canvas collage-preview-canvas"
                      aria-label="Final collage preview"
                    />
                  </div>
                  <div className="tip-note panel-description panel-description-tight" role="note">
                    <span className="tip-note-icon" aria-hidden="true">
                      i
                    </span>
                    <p className="helper-text">
                      This is the clean saved version without the arrange handles and guides.
                    </p>
                  </div>
                </div>
              ) : null}
              <div className="export-actions">
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => handleExport('jpeg', 'download')}
                  disabled={!canBuildCollage || isBusy}
                >
                  Save JPEG
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => handleExport('png', 'download')}
                  disabled={!canBuildCollage || isBusy}
                >
                  Save PNG
                </button>
                {canNativeShare ? (
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => handleExport('jpeg', 'share')}
                    disabled={!canBuildCollage || isBusy}
                  >
                    Share / Save to Photos
                  </button>
                ) : null}
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => setConfirmAction('clear')}
                  disabled={tiles.length === 0 || isBusy}
                >
                  Start a New Collage
                </button>
              </div>
              <div className="tip-note panel-description panel-description-tight" role="note">
                <span className="tip-note-icon" aria-hidden="true">
                  i
                </span>
                <p className="helper-text">
                  Collages export at the full preset size exactly as arranged.
                </p>
              </div>
            </section>
          </div>
        </div>
      </section>

      <canvas ref={exportCanvasRef} className="sr-only" aria-hidden="true" />
      <ConfirmModal
        open={confirmAction !== null}
        title={confirmAction === 'reset' ? 'Reset this collage?' : 'Start a new collage?'}
        message={
          confirmAction === 'reset'
            ? 'This will reset your current collage settings back to the defaults. Your photos and saved looks will stay.'
            : 'This will remove the current collage photos and preview. Your collage layout settings will stay.'
        }
        confirmLabel={confirmAction === 'reset' ? 'Reset Collage' : 'Start New Collage'}
        onConfirm={confirmAction === 'reset' ? handleConfirmReset : handleClearPhotos}
        onCancel={() => setConfirmAction(null)}
      />
    </>
  );
}
