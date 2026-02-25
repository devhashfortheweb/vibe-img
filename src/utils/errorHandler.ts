// errorHandler.ts — Error classification, visual error feedback, and logging.

import { VibeImgConfig } from '../config';

// ─── Error types ───────────────────────────────────────────────────────────

export type ErrorType = 'auth' | 'network' | 'api' | 'timeout' | 'config' | 'unknown';

export interface ClassifiedError {
  type: ErrorType;
  title: string;
  detail: string;
  hint: string;
}

const ERROR_THEME: Record<ErrorType, { bg: string; accent: string; fg: string; icon: string }> = {
  auth:    { bg: '#fffbeb', accent: '#f59e0b', fg: '#92400e', icon: 'M12 15v2m0-6v.01M12 3l9.5 16.5H2.5L12 3z' },
  network: { bg: '#fff7ed', accent: '#f97316', fg: '#9a3412', icon: 'M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 5v5l4.25 2.5' },
  api:     { bg: '#fef2f2', accent: '#ef4444', fg: '#991b1b', icon: 'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4m0 4h.01' },
  timeout: { bg: '#eff6ff', accent: '#3b82f6', fg: '#1e40af', icon: 'M12 2a10 10 0 100 20 10 10 0 000-20zm0 6v4l3 3' },
  config:  { bg: '#f5f3ff', accent: '#8b5cf6', fg: '#5b21b6', icon: 'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 0V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 0V4' },
  unknown: { bg: '#f9fafb', accent: '#6b7280', fg: '#374151', icon: 'M12 2a10 10 0 100 20 10 10 0 000-20zm0 14h.01M12 8v4' },
};

// ─── Error classification ──────────────────────────────────────────────────

export function classifyError(error: unknown): ClassifiedError {
  const msg = error instanceof Error ? error.message : String(error);
  const lower = msg.toLowerCase();

  if (lower.includes('no api key') || lower.includes('configure')) {
    const model = msg.match(/"([^"]+)"/)?.[1] || 'this provider';
    return {
      type: 'auth',
      title: 'API key required',
      detail: `No key configured for ${model}.`,
      hint: `VibeImg.configure({ ${model}: 'your-key' })`,
    };
  }

  if (lower.includes('does not support')) {
    const match = msg.match(/"([^"]+)" does not support "([^"]+)".*Supported: (.+)/);
    return {
      type: 'config',
      title: 'Unsupported operation',
      detail: match ? `"${match[1]}" can't do "${match[2]}".` : msg.substring(0, 120),
      hint: match ? `Try: ${match[3]}` : 'Check the op attribute.',
    };
  }

  if (lower.includes('requires a reference image')) {
    return {
      type: 'config',
      title: 'Reference image missing',
      detail: 'This operation needs an input image.',
      hint: 'Add an img-ref attribute pointing to an image URL.',
    };
  }

  if (lower.includes('requires a prompt')) {
    return {
      type: 'config',
      title: 'Prompt missing',
      detail: 'This operation needs a text prompt.',
      hint: 'Add a prompt attribute to <vibe-img>.',
    };
  }

  if (lower.includes('failed to fetch reference image')) {
    const urlMatch = msg.match(/"([^"]+)"/);
    return {
      type: 'network',
      title: 'Reference image unreachable',
      detail: urlMatch ? `Could not load "${urlMatch[1]}".` : 'Could not load the reference image.',
      hint: 'Check the img-ref URL and CORS headers.',
    };
  }

  if (lower.includes('unknown operation')) {
    const op = msg.match(/"([^"]+)"/)?.[1] || '?';
    return {
      type: 'config',
      title: 'Unknown operation',
      detail: `"${op}" is not a valid operation.`,
      hint: 'Use: generate, img2img, upscale, remove-bg, replace-bg, vectorize',
    };
  }

  if (lower.includes('unknown model')) {
    const model = msg.match(/"([^"]+)"/)?.[1] || '?';
    return {
      type: 'config',
      title: 'Unknown model',
      detail: `"${model}" is not registered.`,
      hint: 'Check the model attribute or register a custom adapter.',
    };
  }

  if (lower.includes('timed out') || lower.includes('timeout')) {
    return {
      type: 'timeout',
      title: 'Generation timed out',
      detail: 'The image took too long to generate.',
      hint: 'Try again or use quality="draft" for faster results.',
    };
  }

  if (lower.includes('network') || lower.includes('failed to fetch') || lower.includes('cors')) {
    return {
      type: 'network',
      title: 'Connection failed',
      detail: 'Could not reach the image generation API.',
      hint: 'Check your internet connection and try again.',
    };
  }

  if (lower.includes('api error') || lower.includes('status 4') || lower.includes('status 5')) {
    const detail = msg.replace(/^API error:\s*/i, '').substring(0, 120);
    return {
      type: 'api',
      title: 'Generation failed',
      detail,
      hint: 'Check parameters or try a different prompt.',
    };
  }

  if (lower.includes('non-json') || lower.includes('empty response') || lower.includes('could not extract')) {
    return {
      type: 'api',
      title: 'Unexpected response',
      detail: 'The API returned data in an unexpected format.',
      hint: 'This may be a temporary issue. Try again.',
    };
  }

  return {
    type: 'unknown',
    title: 'Something went wrong',
    detail: msg.substring(0, 120),
    hint: 'Enable debug mode and check the browser console for details.',
  };
}

// ─── ImgError ──────────────────────────────────────────────────────────────

export class ImgError extends Error {
  public readonly svgErrorUrl: string;
  public readonly classified: ClassifiedError;

  constructor(message: string) {
    super(message);
    this.name = 'ImgError';
    this.classified = classifyError(this);
    this.svgErrorUrl = createErrorSvg(this.classified);
  }
}

// ─── SVG error card ────────────────────────────────────────────────────────

function createErrorSvg(err: ClassifiedError): string {
  const theme = ERROR_THEME[err.type];
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
     .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const lines = wrapText(err.detail, 38);
  const hintLines = wrapText(err.hint, 42);
  const totalLines = 1 + lines.length + hintLines.length;
  const h = Math.max(200, 120 + totalLines * 18);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 ${h}">
  <defs>
    <filter id="s" x="-4%" y="-4%" width="108%" height="108%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="3"/>
      <feOffset dy="2"/><feComponentTransfer><feFuncA type="linear" slope="0.08"/></feComponentTransfer>
      <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect width="320" height="${h}" rx="16" fill="${theme.bg}" filter="url(#s)"/>
  <circle cx="160" cy="48" r="24" fill="${theme.accent}" opacity="0.15"/>
  <path d="${theme.icon}" transform="translate(148,36) scale(1)" fill="none" stroke="${theme.accent}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="160" y="96" text-anchor="middle" font-family="system-ui,-apple-system,sans-serif" font-size="15" font-weight="600" fill="${theme.fg}">${esc(err.title)}</text>
  ${lines.map((l, i) =>
    `<text x="160" y="${116 + i * 17}" text-anchor="middle" font-family="system-ui,-apple-system,sans-serif" font-size="12" fill="${theme.fg}" opacity="0.7">${esc(l)}</text>`
  ).join('\n  ')}
  <line x1="80" y1="${120 + lines.length * 17}" x2="240" y2="${120 + lines.length * 17}" stroke="${theme.accent}" opacity="0.2" stroke-width="1"/>
  ${hintLines.map((l, i) =>
    `<text x="160" y="${138 + lines.length * 17 + i * 16}" text-anchor="middle" font-family="ui-monospace,monospace" font-size="10" fill="${theme.accent}" opacity="0.8">${esc(l)}</text>`
  ).join('\n  ')}
</svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function wrapText(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  let current = '';
  for (const word of text.split(' ')) {
    if ((current + word).length > maxChars && current) {
      lines.push(current.trim());
      current = word + ' ';
    } else {
      current += word + ' ';
    }
  }
  if (current.trim()) lines.push(current.trim());
  return lines;
}

// ─── Logger ────────────────────────────────────────────────────────────────
//
// All methods are no-ops unless VibeImgConfig.debug is true,
// except Logger.error() which always fires.
//
// To enable: VibeImg.setup({ debug: true })
// Then reproduce the issue and paste the console output in your bug report.

export const Logger = {
  debug(message: string, context?: unknown) {
    if (!VibeImgConfig.debug) return;
    console.log(`[VibeImg] ${message}`, ...(context !== undefined ? [context] : []));
  },

  // Significant lifecycle events (cache hits, key saves, config changes).
  // Only logged in debug mode.
  info(message: string, context?: unknown) {
    if (!VibeImgConfig.debug) return;
    console.log(`[VibeImg] ${message}`, ...(context !== undefined ? [context] : []));
  },

  // Non-fatal issues (server cache miss, fallback triggered).
  // Only logged in debug mode.
  warn(message: string, context?: unknown) {
    if (!VibeImgConfig.debug) return;
    console.warn(`[VibeImg] ${message}`, ...(context !== undefined ? [context] : []));
  },

  // Always logged — these indicate real failures the user needs to know about.
  error(message: string, raw?: unknown) {
    const detail = raw instanceof Error ? raw.message
      : typeof raw === 'object' && raw !== null ? JSON.stringify(raw)
      : raw !== undefined ? String(raw)
      : '';
    console.error(`[VibeImg] ${message}${detail ? ': ' + detail : ''}`);
  },
};
