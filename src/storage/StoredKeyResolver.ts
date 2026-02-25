// StoredKeyResolver.ts — Resolves API keys from ApiKeyStorage (IndexedDB).

import { IKeyResolver } from '../core/IKeyResolver';
import { ApiKeyStorage } from './ApiKeyStorage';

export class StoredKeyResolver implements IKeyResolver {
  private storage: ApiKeyStorage;

  constructor(storage: ApiKeyStorage) {
    this.storage = storage;
  }

  public getKey(modelId: string): Promise<string | null> {
    return this.storage.getKey(modelId);
  }
}
