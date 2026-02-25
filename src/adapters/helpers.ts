// ==========================================================================
// helpers.ts — Three small utilities. That's all adapters need.
// ==========================================================================

import { STYLE_PREFIX } from './types';

/**
 * If style is in styleMap → return the native value (and leave prompt alone).
 * If not → return null (caller should inject style into prompt instead).
 */
export function mapStyle(style: string | undefined, styleMap: Record<string, string>): string | null {
  if (!style) return null;
  return styleMap[style] ?? null;
}

/**
 * Build the final prompt. If style has no native mapping, prepend it.
 */
export function buildPrompt(prompt: string, style?: string, hasNativeStyle: boolean = false): string {
  if (!style || hasNativeStyle) return prompt;
  const prefix = STYLE_PREFIX[style] ?? `${style} style,`;
  return `${prefix} ${prompt}`;
}

/**
 * Merge rawParams (escape hatch) into body. Raw params always win.
 */
export function mergeRaw(body: Record<string, any>, raw?: Record<string, any>): Record<string, any> {
  return raw ? { ...body, ...raw } : body;
}
