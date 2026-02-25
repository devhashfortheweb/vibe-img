// ServerStorage.ts — Remote image cache backed by a REST API + CDN.
//
// API contract (3 endpoints):
//
//   HEAD {r2PublicUrl}/{key}          → 200 = cached, 404 = miss
//   PUT  {endpoint}/images/{key}      → body: { url, model? } or { b64, contentType, model? }
//   DELETE {endpoint}/images/{key}    → removes cached image
//
// The CDN lookup (HEAD) goes directly to the public URL — no worker.
// Store and delete go through the worker/API endpoint.
//
// Self-hosting: implement these 3 routes against any storage backend
// (S3, R2, GCS, local disk). See /docs/self-host.md for details.

import { IStorage, CacheResult } from './IStorage';
import { makeRequest } from '../utils/network';
import { Logger } from '../utils/errorHandler';
import { VibeImgConfig } from '../config';

export class ServerStorage implements IStorage {
  private endpoint: string;
  public readonly ready: Promise<void> = Promise.resolve();

  constructor(endpoint: string) {
    this.endpoint = endpoint;
  }

  // HEAD directly to CDN — no worker. Returns age from Last-Modified header.
  // Never throws — returns null on any failure (non-fatal).
  public async getImage(key: string): Promise<CacheResult | null> {
    const cdnBase = VibeImgConfig.r2PublicUrl;
    if (!cdnBase) return null;
    const url = `${cdnBase}/${key}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(url, { method: 'HEAD', signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const lastMod = res.headers.get('last-modified');
        const ageMs = lastMod ? Date.now() - new Date(lastMod).getTime() : undefined;
        return { url, ageMs };
      }

      return null;
    } catch {
      return null;
    }
  }

  // PUT to worker. Worker downloads the image and saves it to storage.
  // Returns the permanent CDN URL if the backend provides one.
  // `model` is optional metadata for analytics (stored as R2 custom metadata).
  public async storeImage(key: string, url: string, model?: string): Promise<string | void> {
    if (!this.endpoint) return;

    try {
      const storeUrl = `${this.endpoint}/images/${key}`;
      let payload: Record<string, string>;

      if (url.startsWith('data:')) {
        const [header, b64] = url.split(',');
        const mime = header.match(/:(.*?);/)?.[1] || 'image/png';
        payload = { b64, contentType: mime };
      } else {
        payload = { url };
      }

      if (model) payload.model = model;

      const res = await makeRequest(storeUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-VibeImg-Client': 'v1.0',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.permanentUrl && data.permanentUrl !== url) {
        return data.permanentUrl;
      }
    } catch (e) {
      Logger.warn(`Server store failed for "${key}":`, e);
    }
  }

  public async removeItem(key: string): Promise<void> {
    if (!this.endpoint) return;

    try {
      await makeRequest(`${this.endpoint}/images/${key}`, {
        method: 'DELETE',
        headers: { 'X-VibeImg-Client': 'v1.0' },
      });
    } catch (e) {
      Logger.warn('Server remove failed:', e);
    }
  }
}