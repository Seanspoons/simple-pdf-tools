import { MAX_COLLAGE_COLUMNS } from '../../constants';
import {
  CollageFitMode,
  CollageQualityPreset,
  CollageSettings,
  CollageShapePreset,
  CollageTile
} from '../../types';

interface CanvasSize {
  width: number;
  height: number;
}

export interface CollageLayoutCell {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CollagePackedTile extends CollageLayoutCell {
  id: string;
  index: number;
  column: number;
  row: number;
  colSpan: number;
  rowSpan: number;
}

export interface CollageRenderedRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CollageLayoutMetrics {
  outputWidth: number;
  outputHeight: number;
  columns: number;
  rows: number;
  frameRows: number;
  cellSize: number;
  gridWidth: number;
  gridHeight: number;
}

export interface CollageLayoutFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PackedTilePlacement {
  id: string;
  index: number;
  column: number;
  row: number;
  colSpan: number;
  rowSpan: number;
}

const COLLAGE_BASE_SIZES: Record<CollageShapePreset, CanvasSize> = {
  square: { width: 1080, height: 1080 },
  portrait: { width: 1080, height: 1350 },
  story: { width: 1080, height: 1920 }
};

const COLLAGE_QUALITY_SCALE: Record<CollageQualityPreset, number> = {
  standard: 1,
  hd: 2,
  uhd: 3
};

function getOutputSize(settings: CollageSettings): CanvasSize {
  const baseSize = COLLAGE_BASE_SIZES[settings.shapePreset];
  const scale = COLLAGE_QUALITY_SCALE[settings.qualityPreset];
  return {
    width: baseSize.width * scale,
    height: baseSize.height * scale
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeSpan(value: number, max: number) {
  return clamp(Math.round(value), 1, Math.max(1, max));
}

function canFitAt(
  occupancy: boolean[][],
  column: number,
  row: number,
  colSpan: number,
  rowSpan: number,
  columns: number
) {
  if (column + colSpan > columns) {
    return false;
  }

  for (let rowOffset = 0; rowOffset < rowSpan; rowOffset += 1) {
    for (let columnOffset = 0; columnOffset < colSpan; columnOffset += 1) {
      if (occupancy[row + rowOffset]?.[column + columnOffset]) {
        return false;
      }
    }
  }

  return true;
}

function markOccupied(
  occupancy: boolean[][],
  column: number,
  row: number,
  colSpan: number,
  rowSpan: number,
  columns: number
) {
  for (let rowOffset = 0; rowOffset < rowSpan; rowOffset += 1) {
    const targetRow = row + rowOffset;
    if (!occupancy[targetRow]) {
      occupancy[targetRow] = Array.from({ length: columns }, () => false);
    }

    for (let columnOffset = 0; columnOffset < colSpan; columnOffset += 1) {
      occupancy[targetRow][column + columnOffset] = true;
    }
  }
}

function getRequiredColumns(tiles: CollageTile[], columns: number) {
  return tiles.reduce((maxColumns, tile) => {
    if (tile.gridColumn === null) {
      return maxColumns;
    }

    return Math.max(maxColumns, tile.gridColumn + normalizeSpan(tile.colSpan, MAX_COLLAGE_COLUMNS));
  }, columns);
}

function packTiles(tiles: CollageTile[], columns: number): { placements: PackedTilePlacement[]; rows: number } {
  const safeColumns = clamp(columns, 1, Math.max(1, columns));
  const occupancy: boolean[][] = [];
  const placements: PackedTilePlacement[] = [];
  let maxRow = 0;

  tiles.forEach((tile, index) => {
    const colSpan = normalizeSpan(tile.colSpan, safeColumns);
    const rowSpan = normalizeSpan(tile.rowSpan, 4);
    const preferredColumn =
      tile.gridColumn === null
        ? null
        : clamp(tile.gridColumn, 0, Math.max(0, safeColumns - colSpan));
    const preferredRow = tile.gridRow === null ? null : Math.max(0, tile.gridRow);
    let row = 0;
    let placed = false;

    if (
      preferredColumn !== null &&
      preferredRow !== null &&
      canFitAt(occupancy, preferredColumn, preferredRow, colSpan, rowSpan, safeColumns)
    ) {
      markOccupied(occupancy, preferredColumn, preferredRow, colSpan, rowSpan, safeColumns);
      placements.push({
        id: tile.id,
        index,
        column: preferredColumn,
        row: preferredRow,
        colSpan,
        rowSpan
      });
      maxRow = Math.max(maxRow, preferredRow + rowSpan);
      placed = true;
    }

    while (!placed) {
      for (let column = 0; column <= safeColumns - colSpan; column += 1) {
        if (!canFitAt(occupancy, column, row, colSpan, rowSpan, safeColumns)) {
          continue;
        }

        markOccupied(occupancy, column, row, colSpan, rowSpan, safeColumns);
        placements.push({
          id: tile.id,
          index,
          column,
          row,
          colSpan,
          rowSpan
        });
        maxRow = Math.max(maxRow, row + rowSpan);
        placed = true;
        break;
      }

      row += 1;
    }
  });

  return {
    placements,
    rows: Math.max(maxRow, 1)
  };
}

function chooseFrameRows(columns: number, packedRows: number, outputSize: CanvasSize) {
  const targetAspect = outputSize.width / outputSize.height;
  const idealRows = Math.max(1, Math.round(columns / targetAspect));
  return Math.max(packedRows, idealRows);
}

function getPackedTiles(
  tiles: CollageTile[],
  outputSize: CanvasSize,
  settings: CollageSettings,
  columnOverride?: number
): { tiles: CollagePackedTile[]; metrics: CollageLayoutMetrics } {
  if (tiles.length === 0) {
    return {
      tiles: [],
      metrics: {
        outputWidth: outputSize.width,
        outputHeight: outputSize.height,
        columns: settings.columns,
        rows: 0,
        frameRows: 0,
        cellSize: 0,
        gridWidth: 0,
        gridHeight: 0
      }
    };
  }

  const targetAspect = outputSize.width / outputSize.height;
  const isSquareOutput = Math.abs(targetAspect - 1) < 0.01;

  let safeColumns = getRequiredColumns(
    tiles,
    columnOverride !== undefined
      ? clamp(columnOverride, 2, MAX_COLLAGE_COLUMNS)
      : clamp(settings.columns, 2, MAX_COLLAGE_COLUMNS)
  );
  let { placements, rows } = packTiles(tiles, safeColumns);
  let frameColumns = safeColumns;
  let frameRows = chooseFrameRows(safeColumns, rows, outputSize);

  if (isSquareOutput) {
    const squareSide = Math.max(safeColumns, rows);
    frameColumns = squareSide;
    frameRows = squareSide;
  }

  const cellSize = Math.min(
    (outputSize.width - settings.gap * (frameColumns - 1)) / frameColumns,
    (outputSize.height - settings.gap * (frameRows - 1)) / frameRows
  );
  const gridWidth = cellSize * frameColumns + settings.gap * (frameColumns - 1);
  const gridHeight = cellSize * frameRows + settings.gap * (frameRows - 1);
  const offsetX = (outputSize.width - gridWidth) / 2;
  const offsetY = (outputSize.height - gridHeight) / 2;

  return {
    tiles: placements.map((placement) => ({
      id: placement.id,
      index: placement.index,
      column: placement.column,
      row: placement.row,
      colSpan: placement.colSpan,
      rowSpan: placement.rowSpan,
      x: offsetX + placement.column * (cellSize + settings.gap),
      y: offsetY + placement.row * (cellSize + settings.gap),
      width: cellSize * placement.colSpan + settings.gap * (placement.colSpan - 1),
      height: cellSize * placement.rowSpan + settings.gap * (placement.rowSpan - 1)
    })),
    metrics: {
      outputWidth: outputSize.width,
      outputHeight: outputSize.height,
      columns: frameColumns,
      rows,
      frameRows,
      cellSize,
      gridWidth,
      gridHeight
    }
  };
}

function withRoundedClip(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.clip();
}

function drawImageToRect(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
  fitMode: CollageFitMode
) {
  const imageRatio = image.naturalWidth / image.naturalHeight;
  const rectRatio = width / height;

  let drawWidth = width;
  let drawHeight = height;
  let offsetX = x;
  let offsetY = y;

  if (fitMode === 'cover') {
    if (imageRatio > rectRatio) {
      drawWidth = height * imageRatio;
      offsetX = x - (drawWidth - width) / 2;
    } else {
      drawHeight = width / imageRatio;
      offsetY = y - (drawHeight - height) / 2;
    }
  } else if (imageRatio > rectRatio) {
    drawHeight = width / imageRatio;
    offsetY = y + (height - drawHeight) / 2;
  } else {
    drawWidth = height * imageRatio;
    offsetX = x + (width - drawWidth) / 2;
  }

  context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
}

export function getRenderedImageRect(
  cell: CollageLayoutCell,
  imageWidth: number,
  imageHeight: number,
  fitMode: CollageFitMode
): CollageRenderedRect {
  const imageRatio = imageWidth / imageHeight;
  const rectRatio = cell.width / cell.height;

  let drawWidth = cell.width;
  let drawHeight = cell.height;
  let offsetX = cell.x;
  let offsetY = cell.y;

  if (fitMode === 'cover') {
    return {
      x: cell.x,
      y: cell.y,
      width: cell.width,
      height: cell.height
    };
  }

  if (imageRatio > rectRatio) {
    drawHeight = cell.width / imageRatio;
    offsetY = cell.y + (cell.height - drawHeight) / 2;
  } else {
    drawWidth = cell.height * imageRatio;
    offsetX = cell.x + (cell.width - drawWidth) / 2;
  }

  return {
    x: offsetX,
    y: offsetY,
    width: drawWidth,
    height: drawHeight
  };
}

export function getCollageOutputSize(settings: CollageSettings): CanvasSize {
  return getOutputSize(settings);
}

export function getCollageLayoutMetrics(
  tiles: CollageTile[],
  settings: CollageSettings,
  sizeOverride?: CanvasSize,
  columnOverride?: number
): CollageLayoutMetrics {
  const outputSize = sizeOverride ?? getOutputSize(settings);
  return getPackedTiles(tiles, outputSize, settings, columnOverride).metrics;
}

export function getCollageLayoutCells(
  tiles: CollageTile[],
  settings: CollageSettings,
  sizeOverride?: CanvasSize,
  columnOverride?: number
): CollageLayoutCell[] {
  const outputSize = sizeOverride ?? getOutputSize(settings);
  return getPackedTiles(tiles, outputSize, settings, columnOverride).tiles;
}

export function getCollagePackedTiles(
  tiles: CollageTile[],
  settings: CollageSettings,
  sizeOverride?: CanvasSize,
  columnOverride?: number
): CollagePackedTile[] {
  const outputSize = sizeOverride ?? getOutputSize(settings);
  return getPackedTiles(tiles, outputSize, settings, columnOverride).tiles;
}

export function getCollageLayoutFrame(
  tiles: CollageTile[],
  settings: CollageSettings,
  sizeOverride?: CanvasSize
): CollageLayoutFrame {
  const outputSize = sizeOverride ?? getOutputSize(settings);
  const packedTiles = getPackedTiles(tiles, outputSize, settings).tiles;
  if (packedTiles.length === 0) {
    return {
      x: 0,
      y: 0,
      width: outputSize.width,
      height: outputSize.height
    };
  }

  const minX = Math.min(...packedTiles.map((tile) => tile.x));
  const minY = Math.min(...packedTiles.map((tile) => tile.y));
  const maxX = Math.max(...packedTiles.map((tile) => tile.x + tile.width));
  const maxY = Math.max(...packedTiles.map((tile) => tile.y + tile.height));

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
}

export function renderCollage(
  canvas: HTMLCanvasElement,
  tiles: CollageTile[],
  settings: CollageSettings,
  sizeOverride?: CanvasSize
) {
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas rendering is not available in this browser.');
  }

  const outputSize = sizeOverride ?? getOutputSize(settings);
  canvas.width = outputSize.width;
  canvas.height = outputSize.height;

  context.clearRect(0, 0, outputSize.width, outputSize.height);
  context.fillStyle = settings.backgroundColor;
  context.fillRect(0, 0, outputSize.width, outputSize.height);

  const { tiles: packedTiles } = getPackedTiles(tiles, outputSize, settings);
  packedTiles.forEach((packedTile) => {
    const tile = tiles[packedTile.index];
    if (!tile) {
      return;
    }

    context.save();
    withRoundedClip(
      context,
      packedTile.x,
      packedTile.y,
      packedTile.width,
      packedTile.height,
      settings.cornerRadius
    );

    drawImageToRect(
      context,
      tile.image,
      packedTile.x,
      packedTile.y,
      packedTile.width,
      packedTile.height,
      settings.fitMode
    );
    context.restore();
  });
}
