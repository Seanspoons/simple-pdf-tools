import { CollageSettings, CollageTileDraftState } from '../../types';

const DATABASE_NAME = 'photo-watermarker';
const DATABASE_VERSION = 1;
const STORE_NAME = 'drafts';
const COLLAGE_DRAFT_KEY = 'collage-draft';

interface StoredCollageDraft {
  id: string;
  settings: CollageSettings;
  files: File[];
  tileStates: CollageTileDraftState[];
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

export async function loadCollageDraft(): Promise<StoredCollageDraft | null> {
  const database = await openDatabase();
  if (!database) {
    return null;
  }

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(COLLAGE_DRAFT_KEY);

    request.onsuccess = () => resolve((request.result as StoredCollageDraft | undefined) ?? null);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
  });
}

export async function saveCollageDraft(
  settings: CollageSettings,
  files: File[],
  tileStates: CollageTileDraftState[]
): Promise<void> {
  const database = await openDatabase();
  if (!database) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.put({
      id: COLLAGE_DRAFT_KEY,
      settings,
      files,
      tileStates
    } satisfies StoredCollageDraft);

    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function clearCollageDraft(): Promise<void> {
  const database = await openDatabase();
  if (!database) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.delete(COLLAGE_DRAFT_KEY);

    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
  });
}
