// ==========================================================================
// adapters/index.ts — Import this to register all built-in models.
// ==========================================================================

import { ModelRegistry } from './types';
import { openai }    from './openai';
import { recraft }   from './recraft';


// All built-in adapters in one array (for testing, iteration, etc.)
export const builtinAdapters = [openai, recraft];

/** Call once at library init to register all built-in models */
export function registerAll(): void {
  for (const adapter of builtinAdapters) {
    ModelRegistry.register(adapter);
  }
}

// Re-export individually for direct imports
export { openai, recraft };
