// index.ts — Entry point. Registers <vibe-img> and exposes the VibeImg global.
//
// Usage (that's it — no JS required):
//   <script src="vibeimg.js"></script>
//   <vibe-img model="openai" prompt="a dog on mars" aspect="landscape"></vibe-img>
//
// The component handles API key entry via a built-in modal when needed.

import register from 'preact-custom-element';
import { VibeImgElement } from './dom-adapter/VibeImgElement';
import { registerVibeTheme } from './dom-adapter/VibeTheme';
import { openKeyModal } from './dom-adapter/KeyModal';
import { configure, setup } from './services';
import { ModelRegistry } from './adapters/types';
import { Logger } from './utils/errorHandler';

// ─── Register web component ────────────────────────────────────────────────

const OBSERVED = [
  'model', 'op', 'prompt', 'img-ref', 'aspect', 'img-style',
  'quality', 'params', 'seed', 'alt',
];

register(VibeImgElement, 'vibe-img', OBSERVED);
registerVibeTheme();

// ─── Global API ────────────────────────────────────────────────────────────

declare global {
  interface Window {
    VibeImg: {
      /** Open the API key modal for a provider. */
      openKeyModal: typeof openKeyModal;
      /** Programmatic key storage (advanced — prefer the modal). */
      configure: typeof configure;
      /** Update runtime config (proxy, timeouts). */
      setup: typeof setup;
      /** Access registered model adapters. */
      models: typeof ModelRegistry;
    };
  }
}

window.VibeImg = { openKeyModal, configure, setup, models: ModelRegistry };

Logger.info(`<vibe-img> ready. Models: [${ModelRegistry.ids().join(', ')}]`);