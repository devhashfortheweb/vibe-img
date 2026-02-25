// VibeImgElement.tsx — <vibe-img> web component (render only).
//
// All logic lives in useVibeImg.ts. This file is purely presentational.
// See vibeimg-css.ts for styles.

import { h } from 'preact';
import { useEffect } from 'preact/hooks';
import { injectCSS } from './vibeimg-css';
import { useVibeImg, VibeImgProps } from './useVibeImg';

// ─── Error icons per type ──────────────────────────────────────────────────

const ERROR_ICON: Record<string, string> = {
  auth: '🔑', network: '🌐', api: '⚠️', timeout: '⏱', config: '⚙️', unknown: '❓',
};

// ─── Component ─────────────────────────────────────────────────────────────

export function VibeImgElement(props: VibeImgProps) {
  useEffect(() => { injectCSS(); }, []);

  const {
    status, src, revealed, loaderHiding, error, showExpiry, op,
    wrapRef, onImgLoad, onImgError, onConfigure,
  } = useVibeImg(props);

  // The wrapper uses display:contents — invisible to CSS layout.
  // All children are direct layout children of <vibe-img>.
  return (
    <div ref={wrapRef} style={{ display: 'contents' }}
         data-status={status} data-model={props.model || ''} data-op={op}>

      {/* Loader — visible only during generation, fades out on reveal */}
      {(status === 'loading' || (status === 'done' && !loaderHiding)) && (
        <div class="vibeimg-loader" data-hiding={loaderHiding ? '' : undefined}>
          <div class="vibeimg-loader-icon">
            <div class="vibeimg-frame" />
            <div class="vibeimg-sun" />
            <div class="vibeimg-mountains">
              <svg viewBox="0 0 44 16" preserveAspectRatio="none">
                <path d="M0 16 L12 4 L20 10 L30 2 L44 16" />
              </svg>
            </div>
          </div>
          <span class="vibeimg-loader-text">Generating...</span>
          <div class="vibeimg-loader-bar" />
        </div>
      )}

      {/* Image */}
      {status === 'done' && src && (
        <img
          class={`vibeimg-img ${revealed ? 'vibeimg-revealed' : ''}`}
          src={src}
          alt={props.alt || ''}
          onLoad={onImgLoad}
          onError={onImgError}
        />
      )}

      {/* Expiry badge */}
      {status === 'done' && revealed && showExpiry && (
        <div class="vibeimg-expiry vibeimg-expiry-visible"
             onClick={() => window.open('https://www.vibe-img.com/feedback?isExpiring=true', '_blank')}>
          Expires soon
        </div>
      )}

      {/* Error card */}
      {status === 'error' && error && (
        <div class={`vibeimg-error vibeimg-error-${error.type}`}>
          <div class="vibeimg-error-badge">
            {ERROR_ICON[error.type] || '❓'}
          </div>
          <div class="vibeimg-error-title">{error.title}</div>
          <div class="vibeimg-error-detail">{error.detail}</div>

          {error.type === 'auth' ? (
            <button class="vibeimg-configure-btn" onClick={onConfigure}>
              Configure API Key
            </button>
          ) : (
            error.hint && <div class="vibeimg-error-hint">{error.hint}</div>
          )}
        </div>
      )}
    </div>
  );
}