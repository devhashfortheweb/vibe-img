// IndexDBStorage.ts — Browser-local image cache backed by IndexedDB.

import { IStorage, CacheResult } from './IStorage';
import { Logger } from '../utils/errorHandler';

const DB_NAME   = 'VibeImgCacheDB';
const STORE_NAME = 'imageUrls';

export class IndexDBStorage implements IStorage {
  private db: IDBDatabase | null = null;
  public readonly ready: Promise<void>;

  constructor() {
    this.ready = this.openDB().then(() => {
      Logger.info('IndexedDB opened.');
    }).catch(e => {
      Logger.error('Failed to open IndexedDB:', e);
      throw e;
    });
  }

  private async openDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);

      request.onupgradeneeded = (e) => {
        (e.target as IDBOpenDBRequest).result
          .createObjectStore(STORE_NAME, { keyPath: 'key' });
      };

      request.onsuccess = (e) => {
        this.db = (e.target as IDBOpenDBRequest).result;
        resolve(this.db);
      };

      request.onerror = (e) => reject((e.target as IDBRequest).error);
    });
  }

  private async store(mode: IDBTransactionMode): Promise<IDBObjectStore> {
    const db = await this.openDB();
    return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
  }

  public async storeImage(key: string, url: string): Promise<void> {
    const s = await this.store('readwrite');
    return new Promise<void>((resolve, reject) => {
      const r = s.put({ key, url, storedAt: Date.now() });
      r.onsuccess = () => resolve();
      r.onerror   = (e) => reject((e.target as IDBRequest).error);
    });
  }

  public async getImage(key: string): Promise<CacheResult | null> {
    const s = await this.store('readonly');
    return new Promise((resolve, reject) => {
      const r = s.get(key);
      r.onsuccess = () => {
        if (!r.result?.url) return resolve(null);
        const ageMs = r.result.storedAt ? Date.now() - r.result.storedAt : undefined;
        resolve({ url: r.result.url, ageMs });
      };
      r.onerror = (e) => reject((e.target as IDBRequest).error);
    });
  }

  public async removeItem(key: string): Promise<void> {
    const s = await this.store('readwrite');
    return new Promise<void>((resolve, reject) => {
      const r = s.delete(key);
      r.onsuccess = () => resolve();
      r.onerror   = (e) => reject((e.target as IDBRequest).error);
    });
  }
}
