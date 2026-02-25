// network.ts — HTTP fetch with timeout and structured error extraction.
//
// No routing or proxy logic — callers decide the URL.
//
// externalSignal: lets callers cancel in-flight requests on component unmount,
// closing the TCP connection immediately and avoiding wasted API tokens.

import { VibeImgConfig } from '../config';
import { Logger } from './errorHandler';

export async function makeRequest(
  url: string,
  options: RequestInit = {},
  externalSignal?: AbortSignal,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), VibeImgConfig.requestTimeoutMs);

  const onExternalAbort = () => controller.abort();
  externalSignal?.addEventListener('abort', onExternalAbort);

  Logger.debug(`→ ${options.method || 'GET'} ${url}`);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      mode: 'cors',
    });

    clearTimeout(timeoutId);
    externalSignal?.removeEventListener('abort', onExternalAbort);

    Logger.debug(`← ${response.status} ${url}`);

    if (!response.ok) {
      const text = await response.text();
      let details = text;
      try {
        const json = JSON.parse(text);
        details = json?.error?.message || json?.message || json?.detail || JSON.stringify(json);
      } catch { /* text is fine as-is */ }

      throw new Error(`API error: Status ${response.status}. Details: ${details}`);
    }

    return response;
  } catch (e: any) {
    clearTimeout(timeoutId);
    externalSignal?.removeEventListener('abort', onExternalAbort);
    if (e.message?.startsWith('API error:')) throw e;
    const msg = e.name === 'AbortError' ? 'Request timed out' : e.message;
    throw new Error(`Request to ${url} failed: ${msg}`);
  }
}
