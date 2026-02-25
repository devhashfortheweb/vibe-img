// ==========================================================================
// OpenAI — GPT-Image (gpt-image-1.5)
//
// Docs: https://platform.openai.com/docs/api-reference/images
// Auth: Bearer token
// CORS: proxy required
//
// Endpoints:
//   generate   → POST /v1/images/generations  (JSON)
//   img2img    → POST /v1/images/edits        (multipart)
//   replace-bg → POST /v1/images/edits        (multipart)
//
// CRITICAL: GPT Image models return ONLY b64_json, never url.
// The "url" field is only for DALL-E 2/3 (deprecated).
//
// Parameters NOT in UniversalParams (use rawParams):
//   background: 'transparent' | 'opaque'  (png/webp only)
//   output_compression: 0-100             (jpeg/webp only)
//   moderation: 'auto' | 'low'
//
// NOTE: "style" param (vivid/natural) is DALL-E 3 only.
// GPT Image does NOT accept a style param — all styling goes in the prompt.
// ==========================================================================

import { IModelAdapter, Aspect, Quality, BuiltRequest, Operation, UniversalParams } from './types';
import { buildPrompt, mergeRaw } from './helpers';

// ─── Constants ─────────────────────────────────────────────────────────────

const BASE = 'https://api.openai.com';
const DEFAULT_MODEL = 'gpt-image-1.5';

// ─── Mapping tables ────────────────────────────────────────────────────────

const ASPECT: Record<Aspect, string> = {
  square:    '1024x1024',
  landscape: '1536x1024',
  portrait:  '1024x1536',
  wide:      '1536x1024',
  tall:      '1024x1536',
};

// GPT Image quality: low | medium | high | auto
const QUALITY: Record<Quality, string> = {
  draft:    'low',
  standard: 'auto',
  hd:       'high',
};

// ─── Adapter ───────────────────────────────────────────────────────────────

export const openai: IModelAdapter = {
  id: 'openai',
  name: 'OpenAI (GPT-Image)',
  supportedOps: ['generate', 'img2img', 'replace-bg'],
  corsMode: 'proxy',

  responseConfig: {
    dataPath: ['data'],
    urlKey: 'url',
    b64Key: 'b64_json',
  },

  getAuthHeader: (key) => ({ name: 'Authorization', value: `Bearer ${key}` }),

  buildRequest(params: UniversalParams, op: Operation = 'generate', ref?: Blob): BuiltRequest {
    if (op === 'img2img' || op === 'replace-bg') {
      return buildEditRequest(params, op, ref);
    }
    return buildGenerateRequest(params);
  },

  // GPT Image ALWAYS returns b64_json, never url.
  parseResponseForOp(raw: any, _op: Operation): string {
    const item = raw?.data?.[0];
    if (!item) throw new Error('OpenAI: empty data array');
    if (item.b64_json) return `data:image/png;base64,${item.b64_json}`;
    // Fallback for DALL-E 2/3 via rawParams model override
    if (item.url) return item.url;
    throw new Error('OpenAI: no b64_json or url in response');
  },


};

// ═══════════════════════════════════════════════════════════════════════════
// Build functions
// ═══════════════════════════════════════════════════════════════════════════

function buildGenerateRequest(params: UniversalParams): BuiltRequest {
  const { prompt, aspect = 'square', style, quality = 'standard', format, rawParams } = params;

  const body: Record<string, any> = {
    model: rawParams?.model || DEFAULT_MODEL,
    prompt: buildPrompt(prompt || '', style, false),  // always inject style in prompt
    size: ASPECT[aspect],
    quality: QUALITY[quality],
  };

  if (format) body.output_format = format;

  return {
    url: `${BASE}/v1/images/generations`,
    body: mergeRaw(body, rawParams),
    contentType: 'json',
  };
}

function buildEditRequest(params: UniversalParams, op: Operation, ref?: Blob): BuiltRequest {
  const { prompt, aspect = 'square', style, quality = 'standard', format, rawParams } = params;

  const basePrompt = buildPrompt(prompt || '', style, false);  // always inject style in prompt
  const editPrompt = op === 'replace-bg'
    ? `Replace the background: ${basePrompt}`
    : basePrompt;

  const body: Record<string, any> = {
    model: rawParams?.model || DEFAULT_MODEL,
    prompt: editPrompt,
    size: ASPECT[aspect],
    quality: QUALITY[quality],
  };

  if (ref) body.image = ref;
  if (format) body.output_format = format;

  return {
    url: `${BASE}/v1/images/edits`,
    body: mergeRaw(body, rawParams),
    contentType: 'multipart',
  };
}