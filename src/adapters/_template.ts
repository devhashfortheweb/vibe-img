// ==========================================================================
// _template.ts — Copy this file to add a new image generation provider.
//
// Steps:
//   1. Copy this file → src/adapters/my-provider.ts
//   2. Fill in the mapping tables
//   3. Implement buildRequest() + parseResponseForOp()
//   4. Write at least 5 test fixtures
//   5. Register: ModelRegistry.register(myProvider);
//   6. Run: npx tsx src/test-runner.ts → all green? Ship it.
//
// Design rules:
//   - Validation is handled by Core.ts. Your adapter should NOT check for
//     missing prompts, unsupported ops, or missing ref images.
//   - Universal styles (pixel, watercolor, etc.) are resolved here.
//     Unknown styles are injected into the prompt via buildPrompt().
//   - Provider-specific params go through rawParams, never universal attrs.
// ==========================================================================

import { IModelAdapter, Aspect, Quality, BuiltRequest, Operation, UniversalParams } from './types';
import { buildPrompt, mergeRaw } from './helpers';

// ─── Constants ─────────────────────────────────────────────────────────────

const BASE = 'https://api.your-provider.com';
const DEFAULT_MODEL = 'your-model-v1';

// ─── Mapping tables ────────────────────────────────────────────────────────
// These tables ARE the documentation. Keep them readable.

const ASPECT: Record<Aspect, string> = {
  // Map universal aspects → your provider's size format.
  // Could be: pixel strings ("1024x1024"), ratios ("16:9"), or named presets.
  square:    '1024x1024',
  landscape: '1536x1024',
  portrait:  '1024x1536',
  wide:      '1920x1080',
  tall:      '1080x1920',
};

// Map universal style names → provider's native style values.
// Only include styles your provider supports natively.
// Styles NOT in this map are injected into the prompt automatically.
// See the README for the full list of universal styles.
const STYLE_MAP: Record<string, string> = {
  // realistic: 'photorealistic',
  // pixel:     'pixel_art',
};

// ─── Style resolution ──────────────────────────────────────────────────────

/** Resolve a universal style to a native value, or null for prompt injection. */
function resolveStyle(style: string | undefined): string | null {
  if (!style) return null;
  return STYLE_MAP[style] ?? null;
}

// ─── Adapter ───────────────────────────────────────────────────────────────

export const myProvider: IModelAdapter = {
  id: 'my-provider',        // used in <vibe-img provider="my-provider">
  name: 'My Provider Name',  // human-readable, for error messages and UI

  supportedOps: ['generate'],
  // Add more as your provider supports them:
  // supportedOps: ['generate', 'img2img', 'upscale', 'remove-bg', 'replace-bg', 'vectorize'],

  corsMode: 'proxy',
  // 'proxy'  → requests routed through VibeImg CORS proxy (most APIs need this)
  // 'direct' → requests go straight to the API (if provider sets CORS headers)

  responseConfig: {
    dataPath: ['data'],   // path to image array in response JSON
    urlKey: 'url',        // key for image URL in each item
    // b64Key: 'base64',  // uncomment if provider returns base64 instead
  },

  // Auth: most APIs use Bearer tokens. Override if different.
  getAuthHeader: (key) => ({ name: 'Authorization', value: `Bearer ${key}` }),
  // Examples for other auth styles:
  // getAuthHeader: (key) => ({ name: 'x-api-key', value: key }),

  buildRequest(params: UniversalParams, op: Operation = 'generate', ref?: Blob): BuiltRequest {
    if (op === 'generate') return buildGenerateRequest(params);

    // ref is guaranteed by Core.ts for ops that need it
    if (op === 'img2img') return buildEditRequest(params, ref!);

    // Add more ops as needed:
    // if (op === 'upscale')    return buildProcessRequest(params, ref!, op);
    // if (op === 'remove-bg')  return buildProcessRequest(params, ref!, op);
    // if (op === 'replace-bg') return buildReplaceBgRequest(params, ref!);

    // Should never reach here — Core.ts validates supportedOps first
    throw new Error(`Unhandled operation: "${op}"`);
  },

  // If your provider returns different shapes per operation, implement this.
  // Otherwise, remove it and rely on responseConfig above.
  parseResponseForOp(raw: any, _op: Operation): string {
    const item = raw?.data?.[0];
    if (!item) throw new Error('MyProvider: empty data array');
    if (item.url)      return item.url;
    if (item.b64_json) return `data:image/png;base64,${item.b64_json}`;
    throw new Error('MyProvider: no url or b64_json in response');
  },

  // ─── For ASYNC APIs (uncomment if your provider requires polling) ──────
  //
  // isAsync: true,
  //
  // getPollingInfo(response) {
  //   return { url: response.status_url };
  // },
  //
  // parsePollingResponse(response) {
  //   if (response.status === 'done')   return response.output_url;
  //   if (response.status === 'failed') throw new Error(response.error);
  //   return null; // still processing
  // },

  // ─── Fixtures: REQUIRED. At least 5. ──────────────────────────────────
  // These validate your mappings without calling the API.
  // Run: npx tsx src/test-runner.ts

  fixtures: [
    // ── Generate ──
    {
      name: 'generate: defaults',
      input: { prompt: 'a test image' },
      expect: {
        url: `${BASE}/v1/generate`,
        contentType: 'json',
        bodyIncludes: { prompt: 'a test image', model: DEFAULT_MODEL },
      },
    },
    {
      name: 'generate: aspect mapping',
      input: { prompt: 'test', aspect: 'wide' },
      expect: {
        bodyIncludes: { size: '1920x1080' },
      },
    },
    {
      name: 'generate: non-native style → injected into prompt',
      input: { prompt: 'a castle', style: 'watercolor' },
      expect: {
        promptIncludes: 'watercolor',
        bodyExcludes: ['style'],
      },
    },
    {
      name: 'generate: rawParams override',
      input: { prompt: 'test', rawParams: { custom_field: 'value' } },
      expect: {
        bodyIncludes: { custom_field: 'value' },
      },
    },
    {
      name: 'generate: seed passthrough',
      input: { prompt: 'test', seed: 42 },
      expect: {
        bodyIncludes: { seed: 42 },
      },
    },

    // ── Img2img (if supported) ──
    // {
    //   name: 'img2img: defaults',
    //   input: { prompt: 'add snow' },
    //   op: 'img2img',
    //   expect: {
    //     url: `${BASE}/v1/edit`,
    //     contentType: 'multipart',
    //     bodyIncludes: { prompt: 'add snow' },
    //   },
    // },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// Build functions
//
// One function per operation (or group of similar operations).
// Keep them private — only buildRequest() is the public entry point.
// ═══════════════════════════════════════════════════════════════════════════

/** Text-to-image generation (JSON body). */
function buildGenerateRequest(params: UniversalParams): BuiltRequest {
  const { prompt, aspect = 'square', style, seed, negativePrompt, format, rawParams } = params;

  const nativeStyle = resolveStyle(style);

  const body: Record<string, any> = {
    model: rawParams?.model || DEFAULT_MODEL,
    prompt: buildPrompt(prompt || '', style, nativeStyle !== null),
    size: ASPECT[aspect],
  };

  // Optional fields — only add if your provider supports them
  if (nativeStyle)     body.style = nativeStyle;
  if (seed != null)    body.seed = seed;
  if (negativePrompt)  body.negative_prompt = negativePrompt;
  if (format)          body.output_format = format;

  return {
    url: `${BASE}/v1/generate`,
    body: mergeRaw(body, rawParams),
    contentType: 'json',
  };
}

/** Image-to-image edit (multipart body with reference image). */
function buildEditRequest(params: UniversalParams, ref: Blob): BuiltRequest {
  const { prompt, aspect = 'square', style, seed, negativePrompt, format, rawParams } = params;

  const nativeStyle = resolveStyle(style);

  const body: Record<string, any> = {
    model: rawParams?.model || DEFAULT_MODEL,
    image: ref,  // the reference image Blob
    prompt: buildPrompt(prompt || '', style, nativeStyle !== null),
    size: ASPECT[aspect],
  };

  if (nativeStyle)     body.style = nativeStyle;
  if (seed != null)    body.seed = seed;
  if (negativePrompt)  body.negative_prompt = negativePrompt;
  if (format)          body.output_format = format;

  return {
    url: `${BASE}/v1/edit`,
    body: mergeRaw(body, rawParams),
    contentType: 'multipart',  // Core.ts will build FormData from this
  };
}

// Uncomment for process-style operations (upscale, remove-bg, etc.)
// These typically only need the image, no prompt.
//
// function buildProcessRequest(params: UniversalParams, ref: Blob, op: Operation): BuiltRequest {
//   const { format, rawParams } = params;
//
//   const body: Record<string, any> = {
//     image: ref,
//     response_format: 'url',
//   };
//
//   if (format) body.output_format = format;
//
//   return {
//     url: `${BASE}/v1/${op}`,
//     body: mergeRaw(body, rawParams),
//     contentType: 'multipart',
//   };
// }