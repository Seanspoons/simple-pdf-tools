import { ImageAsset } from '../types';

export interface MetadataField {
  label: string;
  value: string;
}

export interface MetadataGroup {
  id: 'file' | 'camera' | 'datetime' | 'location' | 'other';
  title: string;
  fields: MetadataField[];
}

export interface MetadataSummaryItem {
  id: 'camera' | 'datetime' | 'location' | 'other';
  title: string;
  found: boolean;
  message: string;
}

export interface MetadataInspection {
  groups: MetadataGroup[];
  summary: MetadataSummaryItem[];
  hasEmbeddedMetadata: boolean;
  parseMessage: string | null;
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

function formatValue(value: unknown): string | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (value instanceof Date) {
    return value.toLocaleString();
  }

  if (Array.isArray(value)) {
    const formattedItems = value.map((item) => formatValue(item)).filter(Boolean) as string[];
    return formattedItems.length ? formattedItems.join(', ') : null;
  }

  if (typeof value === 'number') {
    return Number.isInteger(value) ? String(value) : value.toFixed(5).replace(/0+$/, '').replace(/\.$/, '');
  }

  if (typeof value === 'object') {
    return null;
  }

  return String(value);
}

function pushField(fields: MetadataField[], label: string, value: unknown) {
  const formatted = formatValue(value);
  if (!formatted) {
    return;
  }

  fields.push({ label, value: formatted });
}

function extractParsedMetadata(parsed: Record<string, unknown> | null | undefined) {
  const cameraFields: MetadataField[] = [];
  const dateFields: MetadataField[] = [];
  const locationFields: MetadataField[] = [];
  const otherFields: MetadataField[] = [];

  if (parsed) {
    pushField(cameraFields, 'Camera make', parsed.Make);
    pushField(cameraFields, 'Camera model', parsed.Model);
    pushField(cameraFields, 'Lens', parsed.LensModel);
    pushField(cameraFields, 'Software', parsed.Software);

    pushField(dateFields, 'Captured', parsed.DateTimeOriginal ?? parsed.CreateDate);
    pushField(dateFields, 'Modified', parsed.ModifyDate);
    pushField(dateFields, 'Time zone', parsed.OffsetTimeOriginal);

    pushField(locationFields, 'Latitude', parsed.latitude);
    pushField(locationFields, 'Longitude', parsed.longitude);
    pushField(locationFields, 'Altitude', parsed.altitude ?? parsed.GPSAltitude);

    pushField(otherFields, 'Orientation', parsed.Orientation);
    pushField(otherFields, 'Color space', parsed.ColorSpace);
    pushField(otherFields, 'Color profile', parsed.ProfileName);
    pushField(otherFields, 'Description', parsed.ImageDescription);
    pushField(otherFields, 'Artist', parsed.Artist);
    pushField(otherFields, 'Copyright', parsed.Copyright);
    pushField(otherFields, 'ISO', parsed.ISO);
    pushField(otherFields, 'Exposure', parsed.ExposureTime);
    pushField(otherFields, 'F-number', parsed.FNumber);
    pushField(otherFields, 'Focal length', parsed.FocalLength);
  }

  return { cameraFields, dateFields, locationFields, otherFields };
}

function buildSummaryItem(
  id: MetadataSummaryItem['id'],
  title: string,
  fields: MetadataField[],
  foundMessage: string,
  emptyMessage: string
): MetadataSummaryItem {
  return {
    id,
    title,
    found: fields.length > 0,
    message: fields.length > 0 ? foundMessage : emptyMessage
  };
}

export async function inspectImageMetadata(
  file: File,
  imageAsset: ImageAsset | null
): Promise<MetadataInspection> {
  let parsed: Record<string, unknown> | null = null;
  let parseMessage: string | null = null;

  try {
    const exifr = await import('exifr');
    parsed = (await exifr.parse(file, true)) as Record<string, unknown> | null;
  } catch {
    parseMessage =
      'Metadata details could not be fully read from this file, but you can still create a cleaned copy.';
  }

  const { cameraFields, dateFields, locationFields, otherFields } = extractParsedMetadata(parsed);

  const fileFields: MetadataField[] = [
    { label: 'File name', value: file.name },
    { label: 'Format', value: file.type || 'Unknown image type' },
    { label: 'File size', value: formatBytes(file.size) }
  ];

  if (imageAsset) {
    fileFields.push({
      label: 'Dimensions',
      value: `${imageAsset.width} × ${imageAsset.height}px`
    });

    if (imageAsset.wasConverted) {
      fileFields.push({
        label: 'Import note',
        value: 'This image was converted in the browser so it could be opened here.'
      });
    }
  }

  const groups: MetadataGroup[] = [
    { id: 'file', title: 'File Details', fields: fileFields },
    { id: 'camera', title: 'Camera / Device', fields: cameraFields },
    { id: 'datetime', title: 'Date / Time', fields: dateFields },
    { id: 'location', title: 'Location', fields: locationFields },
    { id: 'other', title: 'Other Metadata', fields: otherFields }
  ];

  const summary: MetadataSummaryItem[] = [
    buildSummaryItem(
      'camera',
      'Camera / Device',
      cameraFields,
      'Camera or device information found',
      'No camera or device details found'
    ),
    buildSummaryItem(
      'datetime',
      'Date / Time',
      dateFields,
      'Capture or modification dates found',
      'No date or time metadata found'
    ),
    buildSummaryItem(
      'location',
      'Location',
      locationFields,
      'Location data found',
      'No GPS or location data found'
    ),
    buildSummaryItem(
      'other',
      'Other Metadata',
      otherFields,
      'Other embedded metadata found',
      'No other embedded metadata found'
    )
  ];

  return {
    groups,
    summary,
    hasEmbeddedMetadata: summary.some((item) => item.found),
    parseMessage
  };
}
