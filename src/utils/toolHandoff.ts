const DATABASE_NAME = 'simple-photo-tools';
const DATABASE_VERSION = 1;
const STORE_NAME = 'handoffs';

const COMPRESSOR_HANDOFF_KEY = 'compressor-input';

interface StoredHandoffFile {
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

async function loadStoredFile(key: string): Promise<File | null> {
  const database = await openDatabase();
  if (!database) {
    return null;
  }

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(key);

    request.onsuccess = () =>
      resolve(((request.result as StoredHandoffFile | undefined) ?? null)?.file ?? null);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
  });
}

async function saveStoredFile(key: string, file: File | null): Promise<void> {
  const database = await openDatabase();
  if (!database) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.put({
      id: key,
      file
    } satisfies StoredHandoffFile);

    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
  });
}

async function clearStoredFile(key: string): Promise<void> {
  const database = await openDatabase();
  if (!database) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.delete(key);

    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
  });
}

export function saveCompressorHandoff(file: File | null): Promise<void> {
  return saveStoredFile(COMPRESSOR_HANDOFF_KEY, file);
}

export function loadCompressorHandoff(): Promise<File | null> {
  return loadStoredFile(COMPRESSOR_HANDOFF_KEY);
}

export function clearCompressorHandoff(): Promise<void> {
  return clearStoredFile(COMPRESSOR_HANDOFF_KEY);
}
