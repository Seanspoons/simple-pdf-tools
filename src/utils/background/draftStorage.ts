import { BackgroundRemovalMode, BackgroundRemovalRefinementSettings } from '../backgroundRemovalQuality';

const DATABASE_NAME = 'photo-watermarker';
const DATABASE_VERSION = 1;
const STORE_NAME = 'drafts';
const BACKGROUND_REMOVER_DRAFT_KEY = 'background-remover-draft';

export type BackgroundPreviewMode = 'before' | 'after';
export type BackgroundFillMode = 'transparent' | 'white' | 'color';

interface StoredBackgroundRemoverDraft {
  id: string;
  file: File | null;
  previewMode: BackgroundPreviewMode;
  previewZoom: number;
  removalMode: BackgroundRemovalMode;
  refinementSettings: BackgroundRemovalRefinementSettings;
  backgroundFillMode: BackgroundFillMode;
  backgroundColor: string;
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

export async function loadBackgroundRemoverDraft(): Promise<StoredBackgroundRemoverDraft | null> {
  const database = await openDatabase();
  if (!database) {
    return null;
  }

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(BACKGROUND_REMOVER_DRAFT_KEY);

    request.onsuccess = () =>
      resolve((request.result as StoredBackgroundRemoverDraft | undefined) ?? null);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
  });
}

export async function saveBackgroundRemoverDraft(
  file: File,
  previewMode: BackgroundPreviewMode,
  previewZoom: number,
  removalMode: BackgroundRemovalMode,
  refinementSettings: BackgroundRemovalRefinementSettings,
  backgroundFillMode: BackgroundFillMode,
  backgroundColor: string
): Promise<void> {
  const database = await openDatabase();
  if (!database) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.put({
      id: BACKGROUND_REMOVER_DRAFT_KEY,
      file,
      previewMode,
      previewZoom,
      removalMode,
      refinementSettings,
      backgroundFillMode,
      backgroundColor
    } satisfies StoredBackgroundRemoverDraft);

    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function clearBackgroundRemoverDraft(): Promise<void> {
  const database = await openDatabase();
  if (!database) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.delete(BACKGROUND_REMOVER_DRAFT_KEY);

    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
  });
}
