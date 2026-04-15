const DATABASE_NAME = 'simple-pdf-tools';
const DATABASE_VERSION = 1;
const STORE_NAME = 'tool-drafts';

type DraftRecord<T> = {
  id: string;
  value: T;
};

function openDraftDatabase(): Promise<IDBDatabase | null> {
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

export async function loadToolDraft<T>(draftId: string): Promise<T | null> {
  const database = await openDraftDatabase();
  if (!database) {
    return null;
  }

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(draftId);

    request.onsuccess = () => {
      const record = (request.result as DraftRecord<T> | undefined) ?? null;
      resolve(record?.value ?? null);
    };
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
  });
}

export async function saveToolDraft<T>(draftId: string, value: T): Promise<void> {
  const database = await openDraftDatabase();
  if (!database) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.put({
      id: draftId,
      value
    } satisfies DraftRecord<T>);

    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function clearToolDraft(draftId: string): Promise<void> {
  const database = await openDraftDatabase();
  if (!database) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.delete(draftId);

    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
  });
}
