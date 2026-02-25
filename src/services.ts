// services.ts — Wires singletons. Exposes configure() and setup().

import { VibeImgConfig } from './config';
import { registerAll } from './adapters/index';
import { Core } from './core/Core';
import { IKeyResolver } from './core/IKeyResolver';
import { ApiKeyStorage } from './storage/ApiKeyStorage';
import { StoredKeyResolver } from './storage/StoredKeyResolver';
import { VibeImgStorage } from './storage/VibeImgStorage';
import { Logger } from './utils/errorHandler';

registerAll();

export const apiKeyStorage  = new ApiKeyStorage();
export const keyResolver: IKeyResolver = new StoredKeyResolver(apiKeyStorage);

const storage = new VibeImgStorage(VibeImgConfig.serverStorageEndpoint);

export const coreInstance = new Core(storage, keyResolver);

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Store API keys for one or more providers.
 * Keys are encrypted with AES-GCM and stored in IndexedDB — never leave the device.
 *
 * @example VibeImg.configure({ openai: 'sk-...', recraft: 'rk-...' })
 */
export async function configure(keys: Record<string, string>): Promise<void> {
  await apiKeyStorage.ready;
  for (const [modelId, apiKey] of Object.entries(keys)) {
    await apiKeyStorage.storeKey(modelId, apiKey);
    Logger.info(`API key stored for "${modelId}".`);
  }
}

/**
 * Update runtime config.
 * Pass keyResolver to swap the key resolution strategy entirely.
 *
 * @example VibeImg.setup({ debug: true, requestTimeoutMs: 60_000 })
 */
export function setup(overrides: Partial<typeof VibeImgConfig> & {
  keyResolver?: IKeyResolver;
}): void {
  if (overrides.keyResolver) {
    coreInstance.setKeyResolver(overrides.keyResolver);
    delete overrides.keyResolver;
  }
  Object.assign(VibeImgConfig, overrides);
  Logger.info('Config updated.', overrides);
}
