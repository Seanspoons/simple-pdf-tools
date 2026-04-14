import { ExportFormat, WatermarkSettings } from '../../types';

const DATABASE_NAME = 'photo-watermarker';
const DATABASE_VERSION = 1;
const STORE_NAME = 'drafts';
const WATERMARK_DRAFT_KEY = 'watermark-draft';
const WATERMARK_LOGO_KEY = 'watermark-logo';

interface StoredWatermarkDraft {
  id: string;
  settings: WatermarkSettings;
  exportFormat: ExportFormat;
  previewMode: 'after' | 'before';
  file: File | null;
  watermarkFile: File | null;
}

interface StoredWatermarkLogo {
  id: string;
  file: File | null;
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (!('indexedDB' in window)) {
    return Promise.resolve(null);
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadWatermarkDraft(): Promise<StoredWatermarkDraft | null> {
  const database = await openDatabase();
  if (!database) {
    return null;
  }

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(WATERMARK_DRAFT_KEY);

    request.onsuccess = () => resolve((request.result as StoredWatermarkDraft | undefined) ?? null);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
  });
}

export async function loadWatermarkLogo(): Promise<File | null> {
  const database = await openDatabase();
  if (!database) {
    return null;
  }

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(WATERMARK_LOGO_KEY);

    request.onsuccess = () =>
      resolve(((request.result as StoredWatermarkLogo | undefined) ?? null)?.file ?? null);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
  });
}

export async function saveWatermarkDraft(
  settings: WatermarkSettings,
  exportFormat: ExportFormat,
  previewMode: 'after' | 'before',
  file: File | null,
  watermarkFile: File | null
): Promise<void> {
  const database = await openDatabase();
  if (!database) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.put({
      id: WATERMARK_DRAFT_KEY,
      settings,
      exportFormat,
      previewMode,
      file,
      watermarkFile
    } satisfies StoredWatermarkDraft);

    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function saveWatermarkLogo(file: File | null): Promise<void> {
  const database = await openDatabase();
  if (!database) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.put({
      id: WATERMARK_LOGO_KEY,
      file
    } satisfies StoredWatermarkLogo);

    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function clearWatermarkDraft(): Promise<void> {
  const database = await openDatabase();
  if (!database) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.delete(WATERMARK_DRAFT_KEY);

    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function clearWatermarkLogo(): Promise<void> {
  const database = await openDatabase();
  if (!database) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.delete(WATERMARK_LOGO_KEY);

    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
  });
}
