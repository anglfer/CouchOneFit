/**
 * Almacén local para el uso sin conexión (DEC-018, docs/architecture/pwa-offline.md).
 * IndexedDB real en el navegador; en memoria solo para pruebas. Si no hay
 * IndexedDB ni un almacén inyectado, la función `getStore()` devuelve `null` y
 * el uso sin conexión queda desactivado (nunca se degrada a guardar en claro).
 */

export type StoreArea = 'readCache' | 'meta' | 'outbox';

export interface OfflineStore {
  get<T>(area: StoreArea, key: string): Promise<T | undefined>;
  put(area: StoreArea, key: string, value: unknown): Promise<void>;
  delete(area: StoreArea, key: string): Promise<void>;
  keys(area: StoreArea): Promise<string[]>;
  /** Vacía las áreas indicadas (todas si no se indica ninguna). */
  clear(areas?: StoreArea[]): Promise<void>;
}

const DATABASE = 'couchonefit-offline';
const VERSION = 2;
const AREAS: StoreArea[] = ['readCache', 'meta', 'outbox'];

function request<T>(source: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    source.onsuccess = () => resolve(source.result);
    source.onerror = () => reject(source.error);
  });
}

function done(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export function createIndexedDbStore(factory: IDBFactory): OfflineStore {
  let opened: Promise<IDBDatabase> | undefined;

  function open(): Promise<IDBDatabase> {
    opened ??= new Promise((resolve, reject) => {
      const opening = factory.open(DATABASE, VERSION);
      opening.onupgradeneeded = () => {
        for (const area of AREAS) {
          if (!opening.result.objectStoreNames.contains(area))
            opening.result.createObjectStore(area);
        }
      };
      opening.onsuccess = () => resolve(opening.result);
      opening.onerror = () => {
        opened = undefined;
        reject(opening.error);
      };
    });
    return opened;
  }

  return {
    async get<T>(area: StoreArea, key: string) {
      const db = await open();
      const result = await request(
        db.transaction(area, 'readonly').objectStore(area).get(key)
      );
      return result as T | undefined;
    },
    async put(area, key, value) {
      const db = await open();
      const transaction = db.transaction(area, 'readwrite');
      transaction.objectStore(area).put(value, key);
      await done(transaction);
    },
    async delete(area, key) {
      const db = await open();
      const transaction = db.transaction(area, 'readwrite');
      transaction.objectStore(area).delete(key);
      await done(transaction);
    },
    async keys(area) {
      const db = await open();
      const result = await request(
        db.transaction(area, 'readonly').objectStore(area).getAllKeys()
      );
      return result.map(String);
    },
    async clear(areas = AREAS) {
      const db = await open();
      const transaction = db.transaction(areas, 'readwrite');
      for (const area of areas) transaction.objectStore(area).clear();
      await done(transaction);
    },
  };
}

export function createMemoryStore(): OfflineStore {
  const areas = new Map<StoreArea, Map<string, unknown>>(
    AREAS.map((area) => [area, new Map()])
  );
  const area = (name: StoreArea) => areas.get(name)!;
  return {
    get: async <T>(name: StoreArea, key: string) =>
      area(name).get(key) as T | undefined,
    put: async (name, key, value) => void area(name).set(key, value),
    delete: async (name, key) => void area(name).delete(key),
    keys: async (name) => [...area(name).keys()],
    clear: async (selected = AREAS) =>
      selected.forEach((name) => area(name).clear()),
  };
}

let override: OfflineStore | null | undefined;
let shared: OfflineStore | null | undefined;

/** Solo para pruebas: inyecta un almacén (o `null` para desactivar). */
export function setOfflineStore(store: OfflineStore | null | undefined): void {
  override = store;
}

export function getStore(): OfflineStore | null {
  if (override !== undefined) return override;
  if (shared === undefined) {
    shared =
      typeof indexedDB === 'undefined' ? null : createIndexedDbStore(indexedDB);
  }
  return shared;
}
