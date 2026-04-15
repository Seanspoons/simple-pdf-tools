export type WatermarkPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'center-left'
  | 'center'
  | 'center-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export type WatermarkKind = 'text' | 'image';
export type WatermarkLayout = 'single' | 'proof';
export type WatermarkProofAngle = 'diagonal' | 'reverse-diagonal' | 'horizontal';

export type ExportFormat = 'jpeg' | 'png' | 'webp';
export type CollageFitMode = 'cover' | 'contain';
export type CollageShapePreset = 'square' | 'portrait' | 'story';
export type CollageQualityPreset = 'standard' | 'hd' | 'uhd';

export interface WatermarkSettings {
  kind: WatermarkKind;
  layout: WatermarkLayout;
  text: string;
  position: WatermarkPosition;
  fontFamily: string;
  color: string;
  opacity: number;
  size: number;
  margin: number;
  proofGap: number;
  proofAngle: WatermarkProofAngle;
  bold: boolean;
  shadow: boolean;
  showBackground: boolean;
}

export interface SavedPreset {
  id: string;
  name: string;
  settings: WatermarkSettings;
  exportFormat: ExportFormat;
}

export interface CollageSavedPreset {
  id: string;
  name: string;
  settings: CollageSettings;
}

export interface CollageTileDraftState {
  id: string;
  colSpan: number;
  rowSpan: number;
  gridColumn: number | null;
  gridRow: number | null;
}

export interface ImageAsset {
  file: File;
  objectUrl: string;
  image: HTMLImageElement;
  width: number;
  height: number;
  name: string;
  mimeType: string;
  wasConverted: boolean;
}

export interface CollageTile extends ImageAsset {
  id: string;
  colSpan: number;
  rowSpan: number;
  gridColumn: number | null;
  gridRow: number | null;
}

export interface RenderWatermarkOptions {
  canvas: HTMLCanvasElement;
  image: HTMLImageElement;
  watermarkImage?: HTMLImageElement | null;
  width: number;
  height: number;
  settings: WatermarkSettings;
}

export interface CollageSettings {
  shapePreset: CollageShapePreset;
  qualityPreset: CollageQualityPreset;
  columns: number;
  gap: number;
  backgroundColor: string;
  fitMode: CollageFitMode;
  cornerRadius: number;
  exportFormat: ExportFormat;
}
