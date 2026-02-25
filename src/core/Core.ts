// Core.ts — Executes operations against model adapters, returns image URLs.
//
// Supports: generate, img2img, upscale, remove-bg, replace-bg, vectorize.
// Handles sync/async (polling) APIs, multipart/form-data, and caching.
//
// Cache key contract: Core never computes cache keys. Callers provide one.
// This keeps key derivation in one place (the DOM layer) and means the hash
// only changes when the user edits their HTML, not when the library changes.

import {
  ModelRegistry, UniversalParams, IModelAdapter, BuiltRequest,
  Operation, OP_REQUIREMENTS, ALL_OPERATIONS,
} from '../adapters/types';
import { VibeImgConfig } from '../config';
import { IKeyResolver } from './IKeyResolver';
import { IStorage, CacheResult } from '../storage/IStorage';
import { Logger } from '../utils/errorHandler';
import { makeRequest } from '../utils/network';

export class Core {
  private storage: IStorage;
  private keyResolver: IKeyResolver;

  constructor(storage: IStorage, keyResolver: IKeyResolver) {
    this.storage = storage;
    this.keyResolver = keyResolver;
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  async execute(
    modelId: string,
    params: UniversalParams,
    opts: {
      cacheKey: string;
      op?: Operation;
      refUrl?: string;
      signal?: AbortSignal;
      skipCache?: boolean;
    },
  ): Promise<string> {
    const { cacheKey, op = 'generate', refUrl, signal, skipCache } = opts;

    Logger.debug(`execute() — model="${modelId}" op="${op}" cacheKey="${cacheKey}"`);

    // ── Validate adapter ───────────────────────────────────────────────────

    const adapter = ModelRegistry.get(modelId);
    if (!adapter) {
      const available = ModelRegistry.ids().join(', ') || 'none registered';
      throw new Error(`Unknown model: "${modelId}". Available: ${available}`);
    }

    // ── Validate operation ─────────────────────────────────────────────────

    if (!ALL_OPERATIONS.includes(op)) {
      throw new Error(`Unknown operation: "${op}". Available: ${ALL_OPERATIONS.join(', ')}`);
    }

    if (!adapter.supportedOps.includes(op)) {
      throw new Error(
        `"${adapter.name}" does not support "${op}". ` +
        `Supported: ${adapter.supportedOps.join(', ')}`
      );
    }

    // ── Validate inputs per operation ──────────────────────────────────────

    const reqs = OP_REQUIREMENTS[op];

    if (reqs.prompt && !params.prompt?.trim()) {
      throw new Error(`"${op}" requires a prompt.`);
    }

    if (reqs.ref && !refUrl) {
      throw new Error(`"${op}" requires a reference image (img-ref attribute).`);
    }

    // ── Cache lookup ───────────────────────────────────────────────────────

    if (!skipCache) {
      const cached = await this.storage.getImage(cacheKey);
      if (cached) {
        Logger.info(`Cache hit: "${cacheKey}".`);
        return cached.url;
      }
      Logger.debug(`Cache miss: "${cacheKey}".`);
    }

    // ── API key ────────────────────────────────────────────────────────────

    Logger.debug(`Resolving API key for "${modelId}"...`);
    const apiKey = await this.keyResolver.getKey(modelId);
    if (!apiKey) {
      throw new Error(
        `No API key for "${modelId}". Call VibeImg.configure({ ${modelId}: 'your-key' }) first.`
      );
    }
    Logger.debug(`API key resolved for "${modelId}".`);

    // ── Fetch reference image if needed ────────────────────────────────────

    let refBlob: Blob | undefined;
    if (reqs.ref && refUrl) {
      Logger.debug(`Fetching reference image: "${refUrl}"`);
      refBlob = await this.fetchRefImage(refUrl, signal);
      Logger.debug(`Reference image fetched (${refBlob.size} bytes).`);
    }

    // ── Build and execute request ──────────────────────────────────────────

    const req = adapter.buildRequest(params, op, refBlob);
    Logger.debug(`Request built — url="${req.url}" contentType="${req.contentType}"`, req.body);

    const imageUrl = adapter.isAsync
      ? await this.executeAsync(adapter, req, apiKey, signal)
      : await this.executeSync(adapter, req, apiKey, op, signal);

    Logger.debug(`Storing result in cache: "${cacheKey}"`);
    await this.storage.storeImage(cacheKey, imageUrl, modelId);
    Logger.info(`Completed "${op}", cached as "${cacheKey}".`);

    return imageUrl;
  }

  async lookup(cacheKey: string): Promise<CacheResult | null> {
    Logger.debug(`lookup() — "${cacheKey}"`);
    return this.storage.getImage(cacheKey);
  }

  async invalidateCache(cacheKey: string): Promise<void> {
    Logger.debug(`invalidateCache() — "${cacheKey}"`);
    await this.storage.removeItem(cacheKey);
    Logger.info(`Cache invalidated: "${cacheKey}".`);
  }

  setKeyResolver(resolver: IKeyResolver) {
    this.keyResolver = resolver;
    Logger.info('Key resolver replaced.');
  }

  // ─── Reference image fetching ───────────────────────────────────────────

  private async fetchRefImage(refUrl: string, signal?: AbortSignal): Promise<Blob> {
    if (refUrl.startsWith('data:')) {
      return (await fetch(refUrl)).blob();
    }

    try {
      const response = await fetch(refUrl, { mode: 'cors', signal });
      if (!response.ok) throw new Error(`Status ${response.status}`);
      return response.blob();
    } catch (err: any) {
      throw new Error(`Failed to fetch reference image from "${refUrl}": ${err.message}`);
    }
  }

  // ─── Sync execution ─────────────────────────────────────────────────────

  private async executeSync(
    adapter: IModelAdapter,
    req: BuiltRequest,
    apiKey: string,
    op: Operation = 'generate',
    signal?: AbortSignal,
  ): Promise<string> {
    const response = await this.doFetch(req, adapter, apiKey, signal);
    const json = await this.parseJSON(response, adapter.id);
    return this.extractImageUrl(adapter, json, op);
  }

  // ─── Async execution (polling loop) ─────────────────────────────────────

  private async executeAsync(
    adapter: IModelAdapter,
    req: BuiltRequest,
    apiKey: string,
    signal?: AbortSignal,
  ): Promise<string> {
    if (!adapter.getPollingInfo || !adapter.parsePollingResponse) {
      throw new Error(`"${adapter.id}" is async but missing polling methods.`);
    }

    const response = await this.doFetch(req, adapter, apiKey, signal);
    const json = await this.parseJSON(response, adapter.id);
    const polling = adapter.getPollingInfo(json);

    Logger.debug(`Polling started — url="${polling.url}"`);

    const MAX_ATTEMPTS = 60;
    const DELAY_MS = 2000;

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      if (signal?.aborted) throw new Error('Request aborted');
      await sleep(DELAY_MS);

      Logger.debug(`Poll attempt ${i + 1}/${MAX_ATTEMPTS}`);

      const pollUrl = this.resolveUrl(polling.url, adapter);
      const pollResponse = await makeRequest(pollUrl, {
        method: 'GET',
        headers: this.buildHeaders(adapter, apiKey),
      }, signal);

      const pollJson = await this.parseJSON(pollResponse, adapter.id);
      const imageUrl = adapter.parsePollingResponse(pollJson);

      if (imageUrl !== null) {
        Logger.debug(`Polling complete after ${i + 1} attempt(s).`);
        return imageUrl;
      }
    }

    throw new Error(
      `Request timed out: "${adapter.id}" did not complete in ${(MAX_ATTEMPTS * DELAY_MS) / 1000}s.`
    );
  }

  // ─── HTTP helpers ───────────────────────────────────────────────────────

  private async doFetch(
    req: BuiltRequest,
    adapter: IModelAdapter,
    apiKey: string,
    signal?: AbortSignal,
  ): Promise<Response> {
    const headers: Record<string, string> = this.buildHeaders(adapter, apiKey);
    const init: RequestInit = { method: 'POST', headers };

    if (req.contentType === 'multipart') {
      const formData = new FormData();
      for (const [key, value] of Object.entries(req.body)) {
        formData.append(key, value instanceof Blob ? value : String(value));
      }
      init.body = formData;
      delete headers['Content-Type'];
    } else {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(req.body);
    }

    const url = this.resolveUrl(req.url, adapter);
    return makeRequest(url, init, signal);
  }

  private resolveUrl(url: string, adapter: IModelAdapter): string {
    if (adapter.corsMode === 'proxy' && VibeImgConfig.corsProxyUrl) {
      const proxied = `${VibeImgConfig.corsProxyUrl}${encodeURIComponent(url)}`;
      Logger.debug(`Routing through proxy: ${proxied}`);
      return proxied;
    }
    return url;
  }

  private buildHeaders(adapter: IModelAdapter, apiKey: string): Record<string, string> {
    const auth = adapter.getAuthHeader(apiKey);
    const headers: Record<string, string> = { [auth.name]: auth.value };
    if (adapter.corsMode === 'proxy') {
      headers['X-VibeImg-Client'] = 'v1.0';
    }
    return headers;
  }

  private async parseJSON(response: Response, adapterId: string): Promise<any> {
    try {
      return await response.json();
    } catch {
      throw new Error(`"${adapterId}" returned non-JSON response (status ${response.status}).`);
    }
  }

  // ─── Response parsing ───────────────────────────────────────────────────

  private extractImageUrl(adapter: IModelAdapter, raw: any, op: Operation): string {
    if (adapter.parseResponseForOp) return adapter.parseResponseForOp(raw, op);
    if (adapter.parseResponse)      return adapter.parseResponse(raw);

    const cfg = adapter.responseConfig;
    let data = raw;

    if (cfg.dataPath) {
      for (const key of cfg.dataPath) data = data?.[key];
    }

    if (Array.isArray(data)) data = data[0];
    if (!data) throw new Error(`Empty response from "${adapter.id}".`);

    if (cfg.urlKey && data[cfg.urlKey]) return data[cfg.urlKey];
    if (cfg.b64Key && data[cfg.b64Key]) return `data:image/png;base64,${data[cfg.b64Key]}`;

    throw new Error(`Could not extract image URL from "${adapter.id}" response.`);
  }
}


function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
