// ApiKeyStorage.ts — API keys encrypted with AES-GCM in IndexedDB (BYOK, browser-only).
//
// The CryptoKey is non-extractable — it can decrypt but can't be exported.
// A raw DB dump only yields ciphertext.
//
// Fallback: crypto.subtle requires a secure context (HTTPS or localhost).
// On plain HTTP (dev proxy, Burp), keys are stored unencrypted. Acceptable
// for development — never deploy to HTTP in production.
//
// IDB transaction gotcha: crypto.subtle operations must complete BEFORE
// opening an IDB transaction. Awaiting crypto inside a transaction causes
// the transaction to auto-commit. Encrypt first, then open the transaction.

import { Logger } from '../utils/errorHandler';

const DB_NAME      = 'VibeImgApiKeysDB';
const DB_VERSION   = 2;
const KEYS_STORE   = 'apiKeys';
const CRYPTO_STORE = 'crypto';
const CRYPTO_KEY_ID = 'master';

export class ApiKeyStorage {
  private db: IDBDatabase | null = null;
  private cryptoKey: CryptoKey | null = null;
  public readonly ready: Promise<void>;

  constructor() {
    this.ready = this.init().catch(e => {
      Logger.error('ApiKeyStorage init failed:', e);
      throw e;
    });
  }

  private async init(): Promise<void> {
    await this.openDB();
    this.cryptoKey = await this.getOrCreateCryptoKey();
    const mode = this.cryptoKey ? 'encrypted' : 'unencrypted (non-secure context)';
    Logger.info(`ApiKeyStorage ready (${mode}).`);
  }

  // ─── DB ──────────────────────────────────────────────────────────────────

  private async openDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(KEYS_STORE)) {
          db.createObjectStore(KEYS_STORE, { keyPath: 'modelId' });
        }
        if (!db.objectStoreNames.contains(CRYPTO_STORE)) {
          db.createObjectStore(CRYPTO_STORE, { keyPath: 'id' });
        }
      };

      request.onsuccess = (e) => {
        this.db = (e.target as IDBOpenDBRequest).result;
        resolve(this.db);
      };

      request.onerror = (e) => reject((e.target as IDBRequest).error);
    });
  }

  private async store(name: string, mode: IDBTransactionMode): Promise<IDBObjectStore> {
    const db = await this.openDB();
    return db.transaction(name, mode).objectStore(name);
  }

  // ─── CryptoKey (AES-GCM 256, non-extractable) ───────────────────────────

  private async getOrCreateCryptoKey(): Promise<CryptoKey | null> {
    if (!globalThis.crypto?.subtle) {
      Logger.warn('crypto.subtle unavailable (non-secure context). Keys stored unencrypted.');
      return null;
    }

    const s = await this.store(CRYPTO_STORE, 'readonly');
    const existing = await idbGet<{ id: string; key: CryptoKey }>(s, CRYPTO_KEY_ID);
    if (existing?.key) return existing.key;

    const key = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      false,   // non-extractable
      ['encrypt', 'decrypt'],
    );

    const ws = await this.store(CRYPTO_STORE, 'readwrite');
    await idbPut(ws, { id: CRYPTO_KEY_ID, key });
    Logger.debug('Generated new AES-GCM master key.');
    return key;
  }

  // ─── Encrypt / Decrypt ───────────────────────────────────────────────────

  private async encrypt(plaintext: string): Promise<{ iv: Uint8Array; data: ArrayBuffer }> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plaintext);
    const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, this.cryptoKey!, encoded);
    return { iv, data };
  }

  private async decrypt(iv: Uint8Array, data: ArrayBuffer): Promise<string> {
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, this.cryptoKey!, data);
    return new TextDecoder().decode(decrypted);
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  public async storeKey(modelId: string, key: string): Promise<void> {
    if (!this.cryptoKey) {
      // No encryption available (non-secure context).
      const s = await this.store(KEYS_STORE, 'readwrite');
      await idbPut(s, { modelId, key });
      Logger.debug(`Stored unencrypted key for "${modelId}".`);
      return;
    }

    // Encrypt BEFORE opening the IDB transaction (see file header).
    const { iv, data } = await this.encrypt(key);
    const s = await this.store(KEYS_STORE, 'readwrite');
    await idbPut(s, { modelId, iv, data });
    Logger.debug(`Stored encrypted key for "${modelId}".`);
  }

  public async getKey(modelId: string): Promise<string | null> {
    const s = await this.store(KEYS_STORE, 'readonly');
    const record = await idbGet<any>(s, modelId);
    if (!record) return null;

    // Unencrypted (non-secure context or legacy entry).
    if (typeof record.key === 'string') return record.key;

    if (!this.cryptoKey || !record.iv || !record.data) return null;

    try {
      return await this.decrypt(record.iv, record.data);
    } catch {
      Logger.warn(`Failed to decrypt key for "${modelId}". Key may need to be re-entered.`);
      return null;
    }
  }
}

// ─── IDB promise helpers ───────────────────────────────────────────────────

function idbGet<T>(store: IDBObjectStore, key: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const r = store.get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror   = (e) => reject((e.target as IDBRequest).error);
  });
}

function idbPut(store: IDBObjectStore, value: any): Promise<void> {
  return new Promise((resolve, reject) => {
    const r = store.put(value);
    r.onsuccess = () => resolve();
    r.onerror   = (e) => reject((e.target as IDBRequest).error);
  });
}
