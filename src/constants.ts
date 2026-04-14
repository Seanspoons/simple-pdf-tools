import { WatermarkSettings } from './types';

export const FONT_OPTIONS = [
  'Arial',
  'Georgia',
  'Times New Roman',
  'Verdana',
  'Trebuchet MS',
  'Courier New',
  'Roboto',
  'Playwrite US Trad'
] as const;

export const DEFAULT_SETTINGS: WatermarkSettings = {
  kind: 'text',
  layout: 'single',
  text: '© Your Name',
  position: 'top-right',
  fontFamily: 'Roboto',
  color: '#ffffff',
  opacity: 1,
  size: 6,
  margin: 1.5,
  proofGap: 28,
  proofAngle: 'diagonal',
  bold: false,
  shadow: false,
  showBackground: false
};

export const SETTINGS_STORAGE_KEY = 'photo-watermarker:settings';
export const EXPORT_FORMAT_STORAGE_KEY = 'photo-watermarker:export-format';
export const PRESETS_STORAGE_KEY = 'photo-watermarker:presets';
export const ACTIVE_TOOL_STORAGE_KEY = 'photo-watermarker:active-tool';
export const COLLAGE_PRESETS_STORAGE_KEY = 'photo-watermarker:collage-presets';
export const COLLAGE_SETTINGS_STORAGE_KEY = 'photo-watermarker:collage-settings';
export const MAX_COLLAGE_COLUMNS = 8;
export const MAX_COLLAGE_IMAGES = 64;
