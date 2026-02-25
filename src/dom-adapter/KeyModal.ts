// KeyModal.ts — Singleton API key modal. One instance for the entire page.
//
// Any <vibe-img> can open it. After save, broadcasts 'vibeimg:keysaved'
// so all components for that model auto-retry.

import { apiKeyStorage } from '../services';
import { ModelRegistry } from '../adapters/types';
import { Logger } from '../utils/errorHandler';

const MODAL_ID       = 'vibeimg-key-modal';
const EVENT_KEY_SAVED = 'vibeimg:keysaved';

// ─── Public API ────────────────────────────────────────────────────────────

/** Open the API key configuration modal for a specific provider. */
export function openKeyModal(modelId: string): void {
  ensureModal();
  showForModel(modelId);
}

/** Register a callback for when a key is saved. Returns an unsubscribe function. */
export function onKeySaved(callback: (modelId: string) => void): () => void {
  const handler = (e: Event) => callback((e as CustomEvent).detail.modelId);
  window.addEventListener(EVENT_KEY_SAVED, handler);
  return () => window.removeEventListener(EVENT_KEY_SAVED, handler);
}

// ─── Modal singleton ───────────────────────────────────────────────────────

let overlay: HTMLDivElement | null = null;
let currentModelId = '';

function ensureModal(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(MODAL_ID)) return;

  injectModalCSS();

  overlay = document.createElement('div');
  overlay.id = MODAL_ID;
  overlay.className = 'vkm-overlay vkm-hidden';

  overlay.innerHTML = `
    <div class="vkm-card">
      <div class="vkm-header">
        <div class="vkm-icon-wrap">
          <svg class="vkm-eye" viewBox="0 0 56 32" width="56" height="32">
            <defs>
              <clipPath id="vkm-eye-clip">
                <path d="M2 16 Q28 -4 54 16 Q28 36 2 16Z" />
              </clipPath>
            </defs>
            <path class="vkm-eye-shape" d="M2 16 Q28 -4 54 16 Q28 36 2 16Z" />
            <g clip-path="url(#vkm-eye-clip)">
              <g class="vkm-iris-group">
                <circle class="vkm-iris" cx="28" cy="16" r="10" />
                <circle class="vkm-pupil" cx="28" cy="16" r="5" />
                <circle class="vkm-highlight" cx="31" cy="13" r="2" />
              </g>
            </g>
          </svg>
        </div>
        <h3 class="vkm-title">Configure API Key</h3>
        <p class="vkm-subtitle"></p>
      </div>
      <div class="vkm-body">
        <label class="vkm-label">API Key</label>
        <div class="vkm-input-row">
          <input class="vkm-input" type="password" placeholder="Enter your API key..." autocomplete="off" spellcheck="false" />
          <button class="vkm-toggle-vis" type="button" title="Show/hide key">👁</button>
        </div>
        <p class="vkm-help">Encrypted and saved locally in your browser.</p>
        <div class="vkm-status vkm-hidden"></div>
      </div>
      <div class="vkm-actions">
        <button class="vkm-btn vkm-btn-cancel" type="button">Cancel</button>
        <button class="vkm-btn vkm-btn-save" type="button">Save & Generate</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const card      = overlay.querySelector('.vkm-card') as HTMLElement;
  const input     = overlay.querySelector('.vkm-input') as HTMLInputElement;
  const toggleVis = overlay.querySelector('.vkm-toggle-vis') as HTMLButtonElement;
  const btnCancel = overlay.querySelector('.vkm-btn-cancel') as HTMLButtonElement;
  const btnSave   = overlay.querySelector('.vkm-btn-save') as HTMLButtonElement;

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) hideModal();
  });

  card.addEventListener('click', (e) => e.stopPropagation());

  toggleVis.addEventListener('click', () => {
    input.type = input.type === 'password' ? 'text' : 'password';
    toggleVis.textContent = input.type === 'password' ? '👁' : '🙈';
  });

  btnCancel.addEventListener('click', hideModal);

  btnSave.addEventListener('click', async () => {
    const key = input.value.trim();
    if (!key) {
      showStatus('Please enter an API key.', 'error');
      return;
    }

    btnSave.disabled = true;
    btnSave.textContent = 'Saving...';

    try {
      await apiKeyStorage.ready;
      await apiKeyStorage.storeKey(currentModelId, key);
      Logger.info(`API key saved for "${currentModelId}".`);

      showStatus('Key saved!', 'success');
      setTimeout(() => {
        hideModal();
        window.dispatchEvent(new CustomEvent(EVENT_KEY_SAVED, {
          detail: { modelId: currentModelId },
        }));
      }, 400);
    } catch (err) {
      Logger.error('Failed to save key:', err);
      showStatus('Failed to save. Try again.', 'error');
      btnSave.disabled = false;
      btnSave.textContent = 'Save & Generate';
    }
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') btnSave.click();
  });
}

function showForModel(modelId: string): void {
  if (!overlay) return;

  currentModelId = modelId;
  const adapter     = ModelRegistry.get(modelId);
  const displayName = adapter?.name || modelId;

  const subtitle = overlay.querySelector('.vkm-subtitle') as HTMLElement;
  const input    = overlay.querySelector('.vkm-input') as HTMLInputElement;
  const btnSave  = overlay.querySelector('.vkm-btn-save') as HTMLButtonElement;
  const status   = overlay.querySelector('.vkm-status') as HTMLElement;
  const toggleVis = overlay.querySelector('.vkm-toggle-vis') as HTMLButtonElement;

  subtitle.textContent = `Enter your ${displayName} API key to generate images.`;
  input.value = '';
  input.type  = 'password';
  btnSave.disabled = false;
  btnSave.textContent = 'Save & Generate';
  status.classList.add('vkm-hidden');
  toggleVis.textContent = '👁';

  overlay.classList.remove('vkm-hidden');
  Logger.debug(`Key modal opened for "${modelId}".`);

  // Show masked existing key as placeholder if one is already stored.
  apiKeyStorage.ready
    .then(() => apiKeyStorage.getKey(modelId))
    .then(existing => {
      input.placeholder = existing ? maskKey(existing) : 'Enter your API key...';
    });

  setTimeout(() => input.focus(), 100);
}

function hideModal(): void {
  if (!overlay) return;
  overlay.classList.add('vkm-hidden');
  Logger.debug('Key modal closed.');
}

function showStatus(msg: string, type: 'success' | 'error'): void {
  if (!overlay) return;
  const el = overlay.querySelector('.vkm-status') as HTMLElement;
  el.textContent = msg;
  el.className = `vkm-status vkm-status-${type}`;
}

function maskKey(key: string): string {
  if (key.length <= 8) return '••••••••';
  return key.substring(0, 4) + '••••' + key.substring(key.length - 4);
}

// ─── CSS ───────────────────────────────────────────────────────────────────

function injectModalCSS(): void {
  if (document.getElementById('vibeimg-modal-css')) return;

  const s = document.createElement('style');
  s.id = 'vibeimg-modal-css';
  s.textContent = `
.vkm-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,.6);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 99999;
  padding: 20px;
  animation: vkm-fadein .2s ease;
}
.vkm-overlay.vkm-hidden { display: none; }

.vkm-card {
  background: #fff;
  border-radius: 20px;
  width: 100%; max-width: 420px;
  box-shadow: 0 24px 80px rgba(0,0,0,.25);
  animation: vkm-slideup .3s cubic-bezier(.22,1,.36,1);
  overflow: hidden;
}

.vkm-header {
  padding: 32px 28px 0;
  text-align: center;
}
.vkm-icon-wrap {
  width: 56px; height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
}

/* ── Eye animation ── */
.vkm-eye-shape {
  fill: #fef3c7;
  stroke: #d97706;
  stroke-width: 2;
  stroke-linejoin: round;
}
.vkm-iris-group {
  animation: vkm-look-around 4s ease-in-out infinite;
}
.vkm-iris { fill: #92400e; }
.vkm-pupil { fill: #1c1917; }
.vkm-highlight { fill: #fff; opacity: 0.8; }

@keyframes vkm-look-around {
  0%, 20%   { transform: translateX(0); }
  30%, 45%  { transform: translateX(6px); }
  55%, 70%  { transform: translateX(-5px); }
  80%, 100% { transform: translateX(0); }
}

.vkm-title {
  margin: 0 0 8px;
  font-size: 20px; font-weight: 700;
  color: #111827;
  font-family: system-ui, -apple-system, sans-serif;
}
.vkm-subtitle {
  margin: 0;
  font-size: 14px; color: #6b7280;
  line-height: 1.5;
  font-family: system-ui, -apple-system, sans-serif;
}

.vkm-body { padding: 24px 28px 0; }

.vkm-label {
  display: block;
  font-size: 12px; font-weight: 600;
  color: #374151;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: .05em;
  font-family: system-ui, -apple-system, sans-serif;
}

.vkm-input-row {
  display: flex; gap: 8px;
}
.vkm-input {
  flex: 1;
  padding: 12px 14px;
  border: 2px solid #e5e7eb;
  border-radius: 12px;
  font-size: 14px;
  font-family: ui-monospace, 'SF Mono', monospace;
  outline: none;
  transition: border-color .2s, box-shadow .2s;
  background: #f9fafb;
}
.vkm-input:focus {
  border-color: #f59e0b;
  box-shadow: 0 0 0 4px rgba(245,158,11,.1);
  background: #fff;
}
.vkm-toggle-vis {
  width: 44px;
  border: 2px solid #e5e7eb;
  border-radius: 12px;
  background: #f9fafb;
  cursor: pointer;
  font-size: 16px;
  transition: border-color .2s, background .2s;
}
.vkm-toggle-vis:hover {
  border-color: #d1d5db;
  background: #f3f4f6;
}

.vkm-help {
  margin: 10px 0 0;
  font-size: 12px; color: #9ca3af;
  line-height: 1.4;
  font-family: system-ui, -apple-system, sans-serif;
}

.vkm-status {
  margin-top: 12px;
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 500;
  font-family: system-ui, -apple-system, sans-serif;
  animation: vkm-fadein .2s ease;
}
.vkm-status.vkm-hidden { display: none; }
.vkm-status-success { background: #ecfdf5; color: #065f46; }
.vkm-status-error   { background: #fef2f2; color: #991b1b; }

.vkm-actions {
  padding: 20px 28px 28px;
  display: flex; gap: 12px;
  justify-content: flex-end;
}
.vkm-btn {
  padding: 11px 22px;
  border: none; border-radius: 12px;
  font-size: 14px; font-weight: 600;
  cursor: pointer;
  transition: all .2s;
  font-family: system-ui, -apple-system, sans-serif;
}
.vkm-btn:disabled { opacity: .5; cursor: default; }
.vkm-btn-cancel {
  background: #f3f4f6; color: #374151;
}
.vkm-btn-cancel:hover { background: #e5e7eb; }
.vkm-btn-save {
  background: linear-gradient(135deg, #f59e0b, #d97706);
  color: #fff;
  box-shadow: 0 2px 8px rgba(245,158,11,.3);
}
.vkm-btn-save:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(245,158,11,.4);
}

@keyframes vkm-fadein { from { opacity: 0; } to { opacity: 1; } }
@keyframes vkm-slideup {
  from { opacity: 0; transform: translateY(16px) scale(.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

@media (max-width: 480px) {
  .vkm-card { border-radius: 20px 20px 0 0; }
  .vkm-overlay { align-items: flex-end; padding: 0; }
}
  `;
  document.head.appendChild(s);
}