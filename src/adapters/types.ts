// types.ts — Contract definitions, shared data, and model registry.
//
// Flow: HTML attributes → UniversalParams → adapter.buildRequest() → BuiltRequest
//       API response    → adapter.responseConfig                   → image URL

// ─── Operations ────────────────────────────────────────────────────────────

export type Operation =
  | 'generate'      // text → image
  | 'img2img'       // image + prompt → image
  | 'upscale'       // image → image (higher res)
  | 'remove-bg'     // image → image (transparent bg)
  | 'replace-bg'    // image + prompt → image (new background)
  | 'vectorize';    // image → SVG

/** Which inputs each operation requires. */
export const OP_REQUIREMENTS: Record<Operation, { prompt: boolean; ref: boolean }> = {
  'generate':     { prompt: true,  ref: false },
  'img2img':      { prompt: true,  ref: true  },
  'upscale':      { prompt: false, ref: true  },
  'remove-bg':    { prompt: false, ref: true  },
  'replace-bg':   { prompt: true,  ref: true  },
  'vectorize':    { prompt: false, ref: true  },
};

export const ALL_OPERATIONS: Operation[] = Object.keys(OP_REQUIREMENTS) as Operation[];

// ─── Universal params (what the user writes) ──────────────────────────────

export interface UniversalParams {
  prompt?: string;
  aspect?: Aspect;
  style?: string;
  quality?: Quality;
  seed?: number;
  n?: number;
  format?: OutputFormat;
  negativePrompt?: string;
  rawParams?: Record<string, any>;
}

export type Aspect       = 'square' | 'landscape' | 'portrait' | 'wide' | 'tall';
export type Quality      = 'draft' | 'standard' | 'hd';
export type OutputFormat = 'png' | 'jpeg' | 'webp';

// ─── Built request (what the adapter returns) ──────────────────────────────

export interface BuiltRequest {
  url: string;
  body: Record<string, any>;
  contentType: 'json' | 'multipart';
}

// ─── Response config (declarative response parsing) ────────────────────────

export interface ResponseConfig {
  /** Path to image array, e.g. ['data'] → response.data[0] */
  dataPath?: string[];
  /** Key for image URL in the data item */
  urlKey?: string;
  /** Key for base64 data (fallback) */
  b64Key?: string;
}

// ─── Adapter interface ─────────────────────────────────────────────────────

export interface IModelAdapter {
  readonly id: string;
  readonly name: string;

  /** Which operations this adapter supports. Must include 'generate'. */
  readonly supportedOps: Operation[];

  /**
   * Whether this API supports browser CORS.
   * 'direct' = API sets CORS headers, call from browser directly.
   * 'proxy'  = API blocks CORS, must route through corsProxyUrl.
   */
  readonly corsMode: 'direct' | 'proxy';

  getAuthHeader(apiKey: string): { name: string; value: string };

  /**
   * Build the HTTP request for the given operation.
   *
   * @param params  Universal params (prompt, aspect, style, etc.)
   * @param op      The operation to perform (default: 'generate')
   * @param ref     Reference image as Blob (for img2img, upscale, etc.)
   */
  buildRequest(params: UniversalParams, op?: Operation, ref?: Blob): BuiltRequest;

  readonly responseConfig: ResponseConfig;

  /** Custom response parser. Overrides responseConfig when defined. */
  parseResponse?(raw: any): string;

  /** Per-operation response parser (if different ops have different response shapes). */
  parseResponseForOp?(raw: any, op: Operation): string;

  /** Async providers (Flux, Replicate) set this to true. */
  readonly isAsync?: boolean;
  getPollingInfo?(response: any): { url: string };
  parsePollingResponse?(response: any): string | null;

  /** Test fixtures — validates mappings at $0 cost. */
  readonly fixtures?: TestFixture[];
}

// ─── Test fixtures ─────────────────────────────────────────────────────────

export interface TestFixture {
  name: string;
  input: UniversalParams;
  op?: Operation;
  expect: {
    url?: string | RegExp;
    contentType?: 'json' | 'multipart';
    bodyIncludes?: Record<string, any>;
    bodyExcludes?: string[];
    promptIncludes?: string;
    promptExcludes?: string;
  };
}

// ─── Shared data ───────────────────────────────────────────────────────────

/** Pixel dimensions for models that accept width × height. */
export const ASPECT_PX: Record<Aspect, [number, number]> = {
  square:    [1024, 1024],
  landscape: [1344, 768],
  portrait:  [768, 1344],
  wide:      [1920, 1080],
  tall:      [1080, 1920],
};

/** Prompt prefixes for models without native style parameters. */
export const STYLE_PREFIX: Record<string, string> = {
  realistic:      'photorealistic,',
  illustration:   'digital illustration,',
  '3d':           '3D rendered,',
  pixel:          'pixel art,',
  anime:          'anime style,',
  vector:         'vector illustration, clean lines,',
  natural:        'natural lighting, realistic,',
  vivid:          'vivid, HDR, dramatic lighting,',
  sketch:         'pencil sketch,',
  watercolor:     'watercolor painting,',
  'oil-painting': 'oil painting,',
  cinematic:      'cinematic, film still,',
  minimalist:     'minimalist, clean,',
  retro:          'retro vintage,',
  comic:          'comic book style,',
  isometric:      'isometric view,',
  flat:           'flat design,',
  neon:           'neon glow, dark background,',
  fantasy:        'fantasy art,',
  abstract:       'abstract art,',
  icon:           'app icon, simple, clean,',
  logo:           'logo design, clean, professional,',
  kawaii:         'kawaii style, cute,',
};

// ─── Model registry ────────────────────────────────────────────────────────

const registry = new Map<string, IModelAdapter>();

/** Global registry of model adapters. Use to register custom providers or inspect available models. */
export const ModelRegistry = {
  register(adapter: IModelAdapter) { registry.set(adapter.id, adapter); },
  get(id: string)     { return registry.get(id); },
  has(id: string)     { return registry.has(id); },
  all()               { return [...registry.values()]; },
  ids()               { return [...registry.keys()]; },
};
