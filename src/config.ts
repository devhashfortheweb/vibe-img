// config.ts — Runtime knobs.
//
// Models    → adapters/types.ts (ModelRegistry)
// API keys  → storage/ApiKeyStorage.ts (IndexedDB)

export interface VibeImgConfigOptions {
  // CORS proxy prefix. Set null to disable.
  // Required for providers that don't set CORS headers (e.g. OpenAI).
  corsProxyUrl: string | null;

  // Worker endpoint for R2 store/remove operations.
  serverStorageEndpoint: string | null;

  // Public CDN base URL for direct R2 cache lookups (HEAD request, no worker).
  r2PublicUrl: string | null;

  // Enable remote R2 caching via serverStorageEndpoint.
  useServerStorage: boolean;

  // HTTP request timeout in ms. Image generation is slow — default is generous.
  requestTimeoutMs: number;

  // Print verbose logs for every action taken by the library.
  // Useful for bug reports: enable this, reproduce the issue, paste the console output.
  debug: boolean;
}

export const VibeImgConfig: VibeImgConfigOptions = {
  corsProxyUrl:            'https://api.vibe-img.com/proxy?url=',
  serverStorageEndpoint:   'https://api.vibe-img.com',
  r2PublicUrl:             'https://cdn.vibe-img.com',
  useServerStorage:        true,
  requestTimeoutMs:        120_000,
  debug:                   false,
};