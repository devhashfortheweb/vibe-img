// VibeImgStorage.ts — Orchestrates IndexedDB + optional R2 server caching.
//
// Write path: IndexedDB first (instant local cache), then async R2.
//   If R2 returns a permanent CDN URL, we overwrite the local entry with it
//   so subsequent lookups hit the CDN directly.
//
// Read path: IndexedDB first. On miss, check R2 CDN (HEAD request).
//   On R2 hit, backfill IndexedDB so the next lookup is local.

import { IStorage, CacheResult } from './IStorage';
import { IndexDBStorage } from './IndexDBStorage';
import { ServerStorage } from './ServerStorage';
import { Logger } from '../utils/errorHandler';
import { VibeImgConfig } from '../config';

export class VibeImgStorage implements IStorage {
  private indexDB: IndexDBStorage;
  private server: ServerStorage;
  private serverEndpoint: string | null;
  public readonly ready: Promise<void>;

  constructor(serverEndpoint: string | null) {
    this.serverEndpoint = serverEndpoint;
    this.indexDB = new IndexDBStorage();
    this.server  = new ServerStorage(serverEndpoint || '');

    this.ready = this.indexDB.ready.then(() => {
      Logger.info('VibeImgStorage ready.');
    }).catch(e => {
      Logger.error('VibeImgStorage init failed:', e);
      throw e;
    });
  }

  public async storeImage(key: string, url: string, model?: string): Promise<string | void> {
    await this.indexDB.storeImage(key, url);
    Logger.debug(`Stored in IndexedDB: "${key}"`);

    if (VibeImgConfig.useServerStorage && this.serverEndpoint) {
      try {
        const permanentUrl = await this.server.storeImage(key, url, model);
        if (permanentUrl && permanentUrl !== url) {
          Logger.debug(`R2 returned permanent URL for "${key}", updating local cache.`);
          await this.indexDB.storeImage(key, permanentUrl);
          return permanentUrl;
        }
      } catch (e) {
        // Server cache failure is non-fatal — local cache still works.
        Logger.warn(`Server store failed for "${key}":`, e);
      }
    }
  }

  public async getImage(key: string): Promise<CacheResult | null> {
    const local = await this.indexDB.getImage(key);
    if (local) {
      Logger.debug(`IndexedDB hit: "${key}"`);
      return local;
    }

    if (VibeImgConfig.useServerStorage && this.serverEndpoint) {
      try {
        const remote = await this.server.getImage(key);
        if (remote) {
          Logger.debug(`R2 hit: "${key}", backfilling IndexedDB.`);
          await this.indexDB.storeImage(key, remote.url);
          return remote;
        }
      } catch (e) {
        Logger.warn(`Server get failed for "${key}":`, e);
      }
    }

    return null;
  }

  public async removeItem(key: string): Promise<void> {
    await this.indexDB.removeItem(key);
    Logger.debug(`Removed from IndexedDB: "${key}"`);

    if (VibeImgConfig.useServerStorage && this.serverEndpoint) {
      try {
        await this.server.removeItem(key);
        Logger.debug(`Removed from R2: "${key}"`);
      } catch (e) {
        Logger.error(`Server remove failed for "${key}":`, e);
      }
    }
  }
}
