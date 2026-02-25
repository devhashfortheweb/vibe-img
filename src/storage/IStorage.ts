// IStorage.ts — Cache storage backend interface.

export interface CacheResult {
  url: string;
  ageMs?: number;
}

export interface IStorage {
  readonly ready: Promise<void>;
  // Returns the permanent URL if the backend rewrote it (e.g. R2 CDN URL), void otherwise.
  storeImage(key: string, url: string, model?: string): Promise<string | void>;
  getImage(key: string): Promise<CacheResult | null>;
  removeItem(key: string): Promise<void>;
}
