// ==========================================================================
// Recraft adapter
//
// Default model: recraftv3 (raster) / recraftv3_vector (vector styles).
// V4 models available via rawParams.model but do NOT support styles.
//
// Style system (updated 2026):
//   - Single `style` param with human-readable names ("Pixel art", "Hand-drawn")
//   - No `substyle` parameter — deprecated by Recraft
//   - Vector styles auto-switch model to recraftv3_vector
//   - V4 models ignore styles entirely (per API spec)
//
// Endpoints:
//   generate   → POST /v1/images/generations             (JSON)  → GenerateImageResponse
//   img2img    → POST /v1/images/imageToImage            (multi) → GenerateImageResponse
//   replace-bg → POST /v1/images/replaceBackground       (multi) → GenerateImageResponse
//   upscale    → POST /v1/images/crispUpscale            (multi) → ProcessImageResponse
//   remove-bg  → POST /v1/images/removeBackground        (multi) → ProcessImageResponse
//   vectorize  → POST /v1/images/vectorize               (multi) → ProcessImageResponse
//
// Response shapes:
//   GenerateImageResponse: { data: [{ url?, b64_json?, image_id }], credits }
//   ProcessImageResponse:  { image: { url?, b64_json?, image_id }, credits }
// ==========================================================================

import { IModelAdapter, BuiltRequest, Aspect, Operation, UniversalParams } from './types';
import { buildPrompt, mergeRaw } from './helpers';

// ─── Constants ─────────────────────────────────────────────────────────────

const BASE = 'https://external.api.recraft.ai';
const DEFAULT_MODEL        = 'recraftv3';
const DEFAULT_VECTOR_MODEL = 'recraftv3_vector';

// ─── Mapping tables ────────────────────────────────────────────────────────

const ASPECT: Record<Aspect, string> = {
  square:    '1:1',
  landscape: '4:3',
  portrait:  '3:4',
  wide:      '16:9',
  tall:      '9:16',
};

const FORMAT_MAP: Record<string, string> = {
  webp: 'webp',
  png:  'png',
  jpeg: 'png',  // fallback: jpeg unsupported by Recraft API
};

// ─── Style system ──────────────────────────────────────────────────────────
//
// Recraft V3 uses a single `style` parameter with flat human-readable names.
// No more `substyle`. Vector styles require the recraftv3_vector model.
//
// References: https://www.recraft.ai/docs/api-reference/styles

interface StyleMapping {
  /** Recraft API style name (exact string sent to API) */
  apiStyle: string;
  /** True = requires recraftv3_vector model instead of recraftv3 */
  vector?: boolean;
}

// ── Universal vibe-img styles → Recraft V3 API styles ──
//
// These are the ONLY styles resolved by the adapter. They represent
// provider-agnostic concepts that vibe-img maps to each provider's
// native format. The same `img-style="pixel"` works on OpenAI, Recraft, etc.
//
// For Recraft-specific styles (e.g. "Neon Calm", "Grain 2.0"), users
// should use raw-params: `raw-params='{"style": "Neon Calm"}'`
//
const STYLE_MAP: Record<string, StyleMapping | null> = {
  // Photorealistic
  realistic:      { apiStyle: 'Photorealism' },
  natural:        { apiStyle: 'Natural light' },
  vivid:          { apiStyle: 'HDR' },
  cinematic:      { apiStyle: 'Evening light' },

  // Illustration
  illustration:   { apiStyle: 'Illustration' },
  '3d':           { apiStyle: 'Clay' },
  pixel:          { apiStyle: 'Pixel art' },
  sketch:         { apiStyle: 'Pencil sketch' },
  watercolor:     { apiStyle: 'Pastel sketch' },
  'oil-painting': { apiStyle: 'Freehand details' },
  comic:          { apiStyle: 'Hard Comics' },
  retro:          { apiStyle: 'Retro Pop' },
  neon:           { apiStyle: 'Neon Calm' },
  fantasy:        { apiStyle: 'Bold fantasy' },
  abstract:       { apiStyle: 'Expressionism' },
  isometric:      null,           // no Recraft equivalent → prompt injection
  anime:          null,           // no Recraft equivalent → prompt injection
  kawaii:         null,           // no Recraft equivalent → prompt injection

  // Vector (auto-switches to recraftv3_vector)
  vector:         { apiStyle: 'Vector art', vector: true },
  minimalist:     { apiStyle: 'Line art', vector: true },
  flat:           { apiStyle: 'Roundish flat', vector: true },
  icon:           { apiStyle: 'Vector art', vector: true },
  logo:           { apiStyle: 'Vector art', vector: true },
};

// ─── Style resolution ──────────────────────────────────────────────────────

/**
 * Resolve a universal style name to a Recraft API style config.
 * Only universal short names are resolved. Everything else → null (injected into prompt).
 * For Recraft-specific styles, users should use raw-params='{"style": "..."}'.
 */
function resolveStyle(style: string | undefined): StyleMapping | null {
  if (!style) return null;
  return STYLE_MAP[style] ?? null;
}

/** Returns true if the model string is a V4 variant */
function isV4(model: string): boolean {
  return model.startsWith('recraftv4');
}

// ─── Endpoints ─────────────────────────────────────────────────────────────

const ENDPOINTS: Record<string, string> = {
  generate:     '/v1/images/generations',
  'img2img':    '/v1/images/imageToImage',
  upscale:      '/v1/images/crispUpscale',
  'remove-bg':  '/v1/images/removeBackground',
  'replace-bg': '/v1/images/replaceBackground',
  vectorize:    '/v1/images/vectorize',
};

const ARRAY_RESPONSE_OPS = new Set(['generate', 'img2img', 'replace-bg']);

// ─── Adapter ───────────────────────────────────────────────────────────────

export const recraft: IModelAdapter = {
  id: 'recraft',
  name: 'Recraft',

  supportedOps: ['generate', 'img2img', 'upscale', 'remove-bg', 'replace-bg', 'vectorize'],
  corsMode: 'direct',

  responseConfig: {
    dataPath: ['data'],
    urlKey: 'url',
  },

  getAuthHeader: (key) => ({ name: 'Authorization', value: `Bearer ${key}` }),

  buildRequest(params: UniversalParams, op: Operation = 'generate', ref?: Blob): BuiltRequest {
    if (op === 'generate') return buildGenerateRequest(params);

    // ref is guaranteed by Core.ts (OP_REQUIREMENTS check) for ops that need it
    if (op === 'img2img')    return buildImg2ImgRequest(params, ref!);
    if (op === 'replace-bg') return buildReplaceBgRequest(params, ref!);
    if (op === 'vectorize')  return buildVectorizeRequest(params, ref!);

    // upscale, remove-bg
    return buildProcessRequest(params, ref!, op);
  },

  parseResponseForOp(raw: any, op: Operation): string {
    if (ARRAY_RESPONSE_OPS.has(op)) {
      const item = raw?.data?.[0];
      if (!item) throw new Error(`Recraft "${op}": empty data array`);
      if (item.url) return item.url;
      if (item.b64_json) return `data:image/png;base64,${item.b64_json}`;
      throw new Error(`Recraft "${op}": no url or b64_json in response.data[0]`);
    }

    const img = raw?.image;
    if (!img) throw new Error(`Recraft "${op}": missing image in response`);
    if (img.url) return img.url;
    if (img.b64_json) return `data:image/png;base64,${img.b64_json}`;
    throw new Error(`Recraft "${op}": no url or b64_json in response.image`);
  },


};

// ═══════════════════════════════════════════════════════════════════════════
// Build functions
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Apply style to request body. Three modes:
 *
 * 1. V4 model: NO style param. Everything → prompt.
 * 2. Resolved style: set as flat `style` param (no substyle).
 * 3. Unresolved style: inject into prompt.
 */
function applyStyle(
  body: Record<string, any>,
  style: string | undefined,
  model: string,
): void {
  if (!style) return;

  // V4: styles not supported, inject everything into prompt
  if (isV4(model)) {
    const resolved = resolveStyle(style);
    const prefix = resolved
      ? `${resolved.apiStyle},`
      : `${style} style,`;
    body.prompt = `${prefix} ${body.prompt}`;
    return;
  }

  // V3: resolve to API style name
  const resolved = resolveStyle(style);

  if (resolved) {
    body.style = resolved.apiStyle;
    // Auto-switch model for vector styles (only if no explicit model override)
    if (resolved.vector && body.model === DEFAULT_MODEL) {
      body.model = DEFAULT_VECTOR_MODEL;
    }
  } else {
    // Unknown style — inject into prompt
    body.prompt = buildPrompt(body.prompt, style, false);
  }
}

function buildGenerateRequest(params: UniversalParams): BuiltRequest {
  const { prompt, aspect = 'square', style, negativePrompt, seed, format, rawParams } = params;

  const model = rawParams?.model || DEFAULT_MODEL;

  const body: Record<string, any> = {
    model,
    prompt: prompt || '',
    size: ASPECT[aspect],
    response_format: 'url',
    block_nsfw: true,
  };

  if (seed != null)   body.random_seed = seed;
  if (negativePrompt) body.negative_prompt = negativePrompt;
  if (format)         body.image_format = FORMAT_MAP[format] || 'png';

  applyStyle(body, style, model);

  return {
    url: `${BASE}/v1/images/generations`,
    body: mergeRaw(body, rawParams),
    contentType: 'json',
  };
}

function buildImg2ImgRequest(params: UniversalParams, ref: Blob): BuiltRequest {
  const { prompt, style, seed, negativePrompt, format, rawParams } = params;

  const model = rawParams?.model || DEFAULT_MODEL;

  const body: Record<string, any> = {
    image: ref,
    prompt: prompt || '',
    strength: rawParams?.strength ?? 0.5,
    model,
    response_format: 'url',
    block_nsfw: true,
  };

  if (seed != null)   body.random_seed = seed;
  if (negativePrompt) body.negative_prompt = negativePrompt;
  if (format)         body.image_format = FORMAT_MAP[format] || 'png';

  applyStyle(body, style, model);

  return {
    url: `${BASE}/v1/images/imageToImage`,
    body: mergeRaw(body, rawParams),
    contentType: 'multipart',
  };
}

function buildReplaceBgRequest(params: UniversalParams, ref: Blob): BuiltRequest {
  const { prompt, style, seed, negativePrompt, format, rawParams } = params;

  const model = rawParams?.model || DEFAULT_MODEL;

  const body: Record<string, any> = {
    image: ref,
    prompt: prompt || '',
    model,
    response_format: 'url',
    block_nsfw: true,
  };

  if (seed != null)   body.random_seed = seed;
  if (negativePrompt) body.negative_prompt = negativePrompt;
  if (format)         body.image_format = FORMAT_MAP[format] || 'png';

  applyStyle(body, style, model);

  return {
    url: `${BASE}/v1/images/replaceBackground`,
    body: mergeRaw(body, rawParams),
    contentType: 'multipart',
  };
}

function buildProcessRequest(params: UniversalParams, ref: Blob, op: Operation): BuiltRequest {
  const { format, rawParams } = params;

  const body: Record<string, any> = {
    image: ref,
    response_format: 'url',
  };

  if (format) body.image_format = FORMAT_MAP[format] || 'png';

  return {
    url: `${BASE}${ENDPOINTS[op]}`,
    body: mergeRaw(body, rawParams),
    contentType: 'multipart',
  };
}

function buildVectorizeRequest(params: UniversalParams, ref: Blob): BuiltRequest {
  const { format, rawParams } = params;

  const body: Record<string, any> = {
    image: ref,
    response_format: 'url',
  };

  if (format) body.image_format = FORMAT_MAP[format] || 'png';

  return {
    url: `${BASE}/v1/images/vectorize`,
    body: mergeRaw(body, rawParams),
    contentType: 'multipart',
  };
}