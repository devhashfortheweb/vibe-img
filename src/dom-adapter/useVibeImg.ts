// useVibeImg.ts — Logic hook for <vibe-img>.
//
// State machine:
//
//   idle ──→ checking ──┬──→ done      (cache hit)
//                       └──→ loading ──┬──→ done   (generated)
//                                      └──→ error
//
// "checking" has no visible UI. This prevents the loader from flashing
// when the image is already cached and resolves instantly.
//
// Cross-component references (img-ref="#id"):
//   Cache keys are derived from the anchor's DOM attributes (readable at t=0),
//   enabling parallel cache lookups without waiting for the anchor to generate.
//   The actual resolved URL is only needed on cache miss, when the API call
//   requires the anchor's output as input blob (e.g. img2img).

import { Ref } from 'preact';
import { useRef, useState, useEffect, useCallback } from 'preact/hooks';
import { UniversalParams, Operation, OP_REQUIREMENTS } from '../adapters/types';
import { Logger, classifyError, ClassifiedError } from '../utils/errorHandler';
import { sha256 } from '../utils/sha256';
import { openKeyModal, onKeySaved } from './KeyModal';

// ─── Types ─────────────────────────────────────────────────────────────────

export type Status = 'idle' | 'checking' | 'loading' | 'done' | 'error';

export interface VibeImgProps {
  model?: string;
  op?: string;
  prompt?: string;
  'img-ref'?: string;
  aspect?: string;
  'img-style'?: string;
  quality?: string;
  format?: string;
  'negative-prompt'?: string;
  params?: string;
  seed?: string;
  alt?: string;
}

export interface VibeImgState {
  status: Status;
  src: string;
  revealed: boolean;
  loaderHiding: boolean;
  error: ClassifiedError | null;
  showExpiry: boolean;
  op: Operation;
  wrapRef: Ref<HTMLDivElement>;
  onImgLoad: () => void;
  onImgError: () => void;
  onConfigure: () => void;
}

// ─── Constants ─────────────────────────────────────────────────────────────

// Show "Expires soon" badge 30 minutes before the 1-hour free-tier TTL.
const EXPIRY_WARN_MS = 30 * 60 * 1000;

// Poll the anchor's resolved-url attribute until it appears (200ms × 300 = 60s max).
const REF_POLL_INTERVAL = 200;
const REF_POLL_MAX      = 300;

// Give up after this many consecutive img load errors to prevent
// an infinite invalidate → generate → fail loop on permanently broken URLs.
const IMG_ERROR_MAX_RETRIES = 2;

// ─── Core singleton ────────────────────────────────────────────────────────

let _core: import('../core/Core').Core | null = null;
async function getCore() {
  if (!_core) { _core = (await import('../services')).coreInstance; }
  return _core;
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useVibeImg(props: VibeImgProps): VibeImgState {
  const [status, setStatus]             = useState<Status>('idle');
  const [src, setSrc]                   = useState('');
  const [revealed, setRevealed]         = useState(false);
  const [loaderHiding, setLoaderHiding] = useState(false);
  const [error, setError]               = useState<ClassifiedError | null>(null);
  const [showExpiry, setShowExpiry]     = useState(false);
  const [themeVer, setThemeVer]         = useState(0);

  const wrapRef       = useRef<HTMLDivElement>(null);
  const genId         = useRef(0);   // incremented to discard stale async responses
  const refPollCount  = useRef(0);   // counter for #id ref polling
  const imgErrorCount = useRef(0);   // consecutive img load errors (capped at IMG_ERROR_MAX_RETRIES)
  const abortRef      = useRef<AbortController | null>(null);

  const op = (props.op || 'generate') as Operation;

  // ── Theme change listener ──────────────────────────────────────────────
  // <vibe-theme> fires a DOM event on attribute change. We increment themeVer
  // to force doExecute to re-run (themeVer is in its dependency array).
  // The new theme prompt is read from the DOM inside doExecute — not stored in state.

  useEffect(() => {
    const h = () => setThemeVer((v: number) => v + 1);
    document.addEventListener('vibeimg:themechange', h);
    return () => document.removeEventListener('vibeimg:themechange', h);
  }, []);

  // ── Can we execute? ────────────────────────────────────────────────────

  // Returns null if ready to execute, or a ClassifiedError describing what's missing.
  const getConfigError = useCallback((): ClassifiedError | null => {
    if (!props.model) return null;
    const reqs = OP_REQUIREMENTS[op];
    if (!reqs) return {
      type: 'config',
      title: 'Unknown operation',
      detail: `"${op}" is not a valid operation.`,
      hint: 'Use: generate, img2img, upscale, remove-bg, replace-bg, vectorize',
    };
    if (reqs.prompt && !props.prompt?.trim()) return {
      type: 'config',
      title: 'Prompt missing',
      detail: 'This operation needs a text prompt.',
      hint: 'Add a prompt attribute to <vibe-img>.',
    };
    if (reqs.ref && !props['img-ref']?.trim()) return {
      type: 'config',
      title: 'Reference image missing',
      detail: `"${op}" needs an input image.`,
      hint: 'Add an img-ref attribute pointing to another <vibe-img> or image URL.',
    };
    return null;
  }, [props.model, props.prompt, props['img-ref'], op]);

  const canExecute = useCallback((): boolean => {
    if (!props.model) return false;
    return getConfigError() === null;
  }, [props.model, getConfigError]);

  // ── Main execution flow ────────────────────────────────────────────────

  const doExecute = useCallback(() => {
    if (!props.model) {
      setStatus('idle');
      setSrc('');
      setRevealed(false);
      setLoaderHiding(false);
      return;
    }
    const configErr = getConfigError();
    if (configErr) {
      Logger.debug(`useVibeImg: config error — ${configErr.title}`, {
        model: props.model, op, prompt: props.prompt, ref: props['img-ref'],
      });
      setError(configErr);
      setStatus('error');
      return;
    }

    const thisGen = ++genId.current;
    Logger.debug(`useVibeImg: starting generation #${thisGen} — model="${props.model}" op="${op}"`);

    // Each execution gets a fresh AbortController. Its signal is passed down to fetch().
    // On unmount or prop change, abort() closes the TCP connection immediately,
    // stopping the API call mid-flight and saving API tokens.
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    setStatus('checking');
    setError(null);
    setShowExpiry(false);

    getCore()
      .then(async core => {
        const params = buildParams(props, wrapRef.current);
        Logger.debug(`useVibeImg: built params`, params);

        // ── 1. Cache lookup ────────────────────────────────────────────
        // For #id refs, derive the cache key from the anchor's DOM attributes
        // (readable at t=0 — no need to wait for the anchor to finish generating).
        const refForKey = props['img-ref']
          ? resolveRefForKey(props['img-ref']) || undefined
          : undefined;

        const cacheKey = await buildRawCacheKey(props, op, wrapRef.current, refForKey);
        Logger.debug(`useVibeImg: cache key = "${cacheKey}"`);

        const cached = await core.lookup(cacheKey);

        if (cached) {
          if (thisGen !== genId.current) {
            Logger.debug(`useVibeImg: gen #${thisGen} superseded (cache hit path), discarding.`);
            return;
          }
          Logger.info(`useVibeImg: cache hit for "${cacheKey}" (age: ${cached.ageMs}ms)`);
          showImage(cached.url);
          if (cached.ageMs && cached.ageMs > EXPIRY_WARN_MS) setShowExpiry(true);
          return;
        }

        Logger.debug(`useVibeImg: cache miss, proceeding to generate.`);

        // ── 2. Resolve reference image URL (if needed) ─────────────────
        // On cache miss, img2img etc. need the anchor's actual output URL.
        // Poll the anchor's resolved-url attribute until it appears.
        let resolvedRef = props['img-ref'] || undefined;

        if (resolvedRef?.startsWith('#')) {
          if (thisGen !== genId.current) return;
          Logger.debug(`useVibeImg: waiting for ref "${resolvedRef}" to resolve...`);
          setStatus('loading');
          resolvedRef = await waitForRef(resolvedRef, thisGen);
          Logger.debug(`useVibeImg: ref resolved to "${resolvedRef}"`);
        }

        // ── 3. Generate ────────────────────────────────────────────────
        if (thisGen !== genId.current) {
          Logger.debug(`useVibeImg: gen #${thisGen} superseded before generate, discarding.`);
          return;
        }

        Logger.debug(`useVibeImg: starting generation — model="${props.model}" op="${op}"`);
        setStatus('loading');
        setRevealed(false);
        setLoaderHiding(false);

        return core.execute(props.model!, params, {
          cacheKey, op, refUrl: resolvedRef, signal, skipCache: true,
        });
      })
      .then(url => {
        if (!url || thisGen !== genId.current) return;
        Logger.info(`useVibeImg: generation complete, url="${url.substring(0, 80)}..."`);
        showImage(url);
      })
      .catch(err => {
        if (thisGen !== genId.current) return;
        if (signal.aborted) {
          Logger.debug(`useVibeImg: gen #${thisGen} aborted (unmount or prop change).`);
          return;
        }
        Logger.error(`useVibeImg: "${op}" failed`, err);
        setError(classifyError(err));
        setStatus('error');
      });

    // ── Helpers (scoped to this execution) ─────────────────────────────

    function showImage(url: string) {
      setSrc(url);
      // Publish the resolved URL so sibling components can use this as a ref.
      wrapRef.current?.parentElement?.setAttribute('resolved-url', url);
      setStatus('done');
      setRevealed(true);
      setLoaderHiding(true);
    }

    // Pure DOM polling — no network, no cache lookups, no re-renders.
    function waitForRef(ref: string, cancelToken: number): Promise<string> {
      refPollCount.current = 0;

      return new Promise((resolve, reject) => {
        const poll = () => {
          if (cancelToken !== genId.current) return reject(new Error('cancelled'));

          const url = resolveRef(ref);
          if (url) return resolve(url);

          if (refPollCount.current++ >= REF_POLL_MAX) {
            return reject(new Error(`Source image "${ref}" did not resolve in time.`));
          }

          Logger.debug(`useVibeImg: ref poll #${refPollCount.current} for "${ref}"`);
          setTimeout(poll, REF_POLL_INTERVAL);
        };
        poll();
      });
    }
  }, [props.model, props.prompt, props['img-ref'], props.aspect, props['img-style'],
      props.quality, props.format, props['negative-prompt'], props.params, props.seed,
      op, canExecute, getConfigError, themeVer]);

  // ── Trigger on prop change ─────────────────────────────────────────────

  useEffect(() => {
    refPollCount.current  = 0;
    imgErrorCount.current = 0;
    doExecute();
    return () => {
      genId.current++;
      abortRef.current?.abort();
    };
  }, [doExecute]);

  // ── Auto-retry when user saves an API key ──────────────────────────────

  useEffect(() => {
    if (!props.model) return;
    return onKeySaved((savedModelId) => {
      if (savedModelId === props.model) {
        Logger.info(`Key saved for "${savedModelId}", retrying.`);
        imgErrorCount.current = 0;
        doExecute();
      }
    });
  }, [props.model, doExecute]);

  // ── Event handlers ─────────────────────────────────────────────────────

  const onImgLoad = useCallback(() => {
    setRevealed(true);
    setTimeout(() => setLoaderHiding(true), 100);
  }, []);

  // Handles <img> load failures (e.g. expired signed URLs).
  // Invalidates the cache entry and retries, but gives up after IMG_ERROR_MAX_RETRIES.
  const onImgError = useCallback(() => {
    if (status !== 'done' || !props.model) return;

    if (imgErrorCount.current >= IMG_ERROR_MAX_RETRIES) {
      Logger.warn(`Image failed to load after ${IMG_ERROR_MAX_RETRIES} retries. Giving up.`);
      setError(classifyError(new Error('Image URL expired and could not be regenerated.')));
      setStatus('error');
      return;
    }

    imgErrorCount.current++;
    Logger.warn(`Image load failed (attempt ${imgErrorCount.current}/${IMG_ERROR_MAX_RETRIES}). Invalidating cache and retrying.`);

    const refForKey = props['img-ref']
      ? resolveRefForKey(props['img-ref']) || undefined
      : undefined;

    getCore()
      .then(async core => {
        const cacheKey = await buildRawCacheKey(props, op, wrapRef.current, refForKey);
        Logger.debug(`useVibeImg: invalidating "${cacheKey}"`);
        return core.invalidateCache(cacheKey);
      })
      .catch(() => {})
      .finally(() => doExecute());
  }, [status, props.model, props['img-ref'], op, doExecute]);

  const onConfigure = useCallback(() => {
    if (props.model) openKeyModal(props.model);
  }, [props.model]);

  // ── Return ─────────────────────────────────────────────────────────────

  return {
    status, src, revealed, loaderHiding, error, showExpiry, op,
    wrapRef, onImgLoad, onImgError, onConfigure,
  };
}

// ─── Ref resolution (pure DOM, stateless) ──────────────────────────────────

// Read the actual image URL from another <vibe-img>'s resolved-url attribute.
// Used for API calls that require the anchor's output as input blob (e.g. img2img).
function resolveRef(ref: string): string | null {
  if (!ref.startsWith('#')) return ref;
  return document.getElementById(ref.slice(1))?.getAttribute('resolved-url') || null;
}

// Build a stable cache key input from the anchor's DOM attributes.
// Readable at t=0 — no need to wait for the anchor to generate.
// Enables parallel cache lookups for all components on the page at load time.
function resolveRefForKey(ref: string): string | null {
  if (!ref.startsWith('#')) return ref;
  const el = document.getElementById(ref.slice(1));
  if (!el) return null;
  return `#${el.id}:${el.getAttribute('model') || ''}:${el.getAttribute('prompt') || ''}`;
}

// ─── Param builder ─────────────────────────────────────────────────────────

function buildParams(props: VibeImgProps, el?: HTMLElement | null): UniversalParams {
  const p: UniversalParams = {};

  if (props.prompt) {
    const host  = el?.parentElement;
    const theme = host?.closest('vibe-theme')?.getAttribute('prompt')?.trim();
    p.prompt = theme ? `${props.prompt}, ${theme}` : props.prompt;
  }

  if (props.aspect)              p.aspect          = props.aspect as any;
  if (props['img-style'])        p.style           = props['img-style'];
  if (props.quality)             p.quality         = props.quality as any;
  if (props.format)              p.format          = props.format as any;
  if (props['negative-prompt'])  p.negativePrompt  = props['negative-prompt'];
  if (props.seed)                p.seed            = parseInt(props.seed, 10) || undefined;

  if (props.params) {
    try { p.rawParams = JSON.parse(props.params); }
    catch { Logger.warn(`Invalid JSON in params attribute: "${props.params}"`); }
  }

  return p;
}

// ─── Cache key builder ─────────────────────────────────────────────────────
//
// Stability guarantee: keys are built from the exact strings the user wrote
// in HTML, not from processed params. This means:
//
//   - Internal refactors (style maps, defaults) don't change the hash.
//   - Library updates never invalidate existing cached images.
//   - The hash only changes when the user edits their HTML.
//
// Adding new props is safe: they're only included when the user explicitly
// sets them, so existing images (without the new prop) hash identically.

async function buildRawCacheKey(
  props: VibeImgProps,
  op: string,
  el?: HTMLElement | null,
  refForKey?: string,
): Promise<string> {
  const host  = el?.parentElement;
  const theme = host?.closest('vibe-theme')?.getAttribute('prompt')?.trim();

  // Sorted keys = deterministic JSON = stable hash regardless of insertion order.
  const obj: Record<string, string> = {};
  if (props.model)              obj.model    = props.model;
  if (op)                       obj.op       = op;
  if (props.prompt)             obj.prompt   = props.prompt;
  if (theme)                    obj.theme    = theme;
  if (props.aspect)             obj.aspect   = props.aspect;
  if (props['img-style'])       obj.style    = props['img-style'];
  if (props.quality)            obj.quality  = props.quality;
  if (props.format)             obj.format   = props.format;
  if (props['negative-prompt']) obj.negprompt = props['negative-prompt'];
  if (props.seed)               obj.seed     = props.seed;
  if (props.params)             obj.params   = props.params;
  if (refForKey)                obj.ref      = refForKey;

  const canonical = JSON.stringify(obj, Object.keys(obj).sort());
  const hex = await sha256(canonical);
  return `vibeimg-${hex}`;
}