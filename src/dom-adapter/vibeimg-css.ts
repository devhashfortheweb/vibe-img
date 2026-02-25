// vibeimg-css.ts — Styles for <vibe-img>. Injected once into <head>.
//
// All classes are prefixed with "vibeimg-" to avoid collisions.
// The host element (vibe-img) uses zero opinionated styles —
// users style it directly like a native <img>.

const STYLE_ID = 'vibeimg-css';

export function injectCSS() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;

  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = CSS;
  document.head.appendChild(s);
}

const CSS = `

/* ═══ Host — behaves like <img> ═══ */

vibe-img {
  display: inline-block;
  position: relative;
  overflow: hidden;
  vertical-align: middle;
  line-height: 0;
  min-width: 120px;
  min-height: 120px;
}

vibe-img[aspect="square"]    { aspect-ratio: 1 / 1; }
vibe-img[aspect="landscape"] { aspect-ratio: 3 / 2; }
vibe-img[aspect="portrait"]  { aspect-ratio: 2 / 3; }
vibe-img[aspect="wide"]      { aspect-ratio: 16 / 9; }
vibe-img[aspect="tall"]      { aspect-ratio: 9 / 16; }

/* ═══ Loader ═══ */

.vibeimg-loader {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: linear-gradient(135deg, #f0eee8 0%, #e8e4dd 50%, #f0eee8 100%);
  background-size: 400% 400%;
  animation: vibeimg-bg-shift 4s ease infinite;
  z-index: 1;
  opacity: 1;
  transition: opacity .4s ease;
}

.vibeimg-loader[data-hiding] {
  opacity: 0;
  pointer-events: none;
}

@keyframes vibeimg-bg-shift {
  0%, 100% { background-position: 0% 50%; }
  50%      { background-position: 100% 50%; }
}

/* Canvas Drawing loader icon */
.vibeimg-loader-icon {
  width: 56px;
  height: 44px;
  position: relative;
  opacity: 0.7;
}

.vibeimg-loader-icon .vibeimg-frame {
  position: absolute;
  inset: 0;
  border: 2px solid #b8a99a;
  border-radius: 2px;
  animation: vibeimg-frame-pulse 3s ease-in-out infinite;
}

.vibeimg-loader-icon .vibeimg-sun {
  position: absolute;
  top: 6px;
  right: 8px;
  width: 8px;
  height: 8px;
  background: #c4b5a5;
  border-radius: 50%;
  animation: vibeimg-fade-sun 3s ease-in-out infinite;
}

.vibeimg-loader-icon .vibeimg-mountains svg {
  position: absolute;
  bottom: 6px;
  left: 6px;
  width: calc(100% - 12px);
  height: 16px;
}

.vibeimg-loader-icon .vibeimg-mountains svg path {
  fill: none;
  stroke: #c4b5a5;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-dasharray: 100;
  stroke-dashoffset: 100;
  animation: vibeimg-draw-landscape 3s ease-in-out infinite;
}

@keyframes vibeimg-draw-landscape {
  0%, 10%  { stroke-dashoffset: 100; }
  50%      { stroke-dashoffset: 0; }
  85%, 100% { stroke-dashoffset: -100; }
}

@keyframes vibeimg-fade-sun {
  0%, 10%   { opacity: 0; transform: scale(0.5); }
  35%, 65%  { opacity: 0.6; transform: scale(1); }
  85%, 100% { opacity: 0; transform: scale(0.5); }
}

@keyframes vibeimg-frame-pulse {
  0%, 100% { border-color: rgba(184,169,154, 0.3); }
  50%      { border-color: rgba(184,169,154, 0.8); }
}

.vibeimg-loader-text {
  font: 500 11px/1 system-ui, -apple-system, sans-serif;
  color: #9a918a;
  letter-spacing: 0.04em;
}

.vibeimg-loader-bar {
  position: absolute;
  bottom: 0; left: 0;
  height: 3px;
  background: linear-gradient(90deg, transparent, #b8a99a, transparent);
  animation: vibeimg-progress 3s ease-in-out infinite;
  border-radius: 2px;
  opacity: 0.5;
}

@keyframes vibeimg-progress {
  0%   { width: 0;   left: 0; }
  50%  { width: 60%;  left: 20%; }
  100% { width: 0;    left: 100%; }
}

/* ═══ Image ═══ */

vibe-img img.vibeimg-img {
  display: block;
  width: 100%; height: 100%;
  object-fit: cover;
  opacity: 0;
  transform: scale(1.01);
  transition: opacity .5s ease, transform .6s cubic-bezier(.22,1,.36,1);
}

vibe-img img.vibeimg-img.vibeimg-revealed {
  opacity: 1;
  transform: scale(1);
}

/* ═══ Expiry badge ═══ */

.vibeimg-expiry {
  position: absolute;
  top: 12px; right: 12px;
  z-index: 2;
  background: rgba(234,179,8,0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  color: #fff;
  font: 600 10px/1 system-ui, -apple-system, sans-serif;
  padding: 7px 14px;
  border-radius: 6px;
  cursor: pointer;
  opacity: 0;
  transition: opacity .3s ease;
  pointer-events: none;
  white-space: nowrap;
  letter-spacing: 0.02em;
}

.vibeimg-expiry.vibeimg-expiry-visible {
  opacity: 1;
  pointer-events: auto;
  animation: vibeimg-pulse 3s ease-in-out infinite;
}

.vibeimg-expiry:hover {
  background: rgba(202,138,4,0.95);
  animation: none;
}

@keyframes vibeimg-pulse {
  0%, 100% { opacity: 0.85; }
  50%      { opacity: 0.55; }
}

/* ═══ Error card ═══ */

.vibeimg-error {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
  box-sizing: border-box;
  text-align: center;
  font-family: system-ui, -apple-system, sans-serif;
  z-index: 1;
  animation: vibeimg-fadein .3s ease;
}

.vibeimg-error-badge {
  width: 40px; height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 10px;
  font-size: 18px;
}

.vibeimg-error-title  { font-size: 13px; font-weight: 600; color: #1f2937; margin-bottom: 4px; }
.vibeimg-error-detail { font-size: 11px; color: #6b7280; max-width: 240px; line-height: 1.45; margin-bottom: 10px; }

.vibeimg-error-hint {
  font: 10px/1.4 ui-monospace, 'SF Mono', monospace;
  color: #9ca3af;
  background: rgba(0,0,0,.04);
  padding: 4px 10px;
  border-radius: 5px;
  max-width: 260px;
  word-break: break-all;
}

.vibeimg-configure-btn {
  margin-top: 4px;
  padding: 8px 20px;
  background: linear-gradient(135deg, #f59e0b, #d97706);
  color: #fff;
  border: none;
  border-radius: 8px;
  font: 600 12px/1 system-ui, -apple-system, sans-serif;
  cursor: pointer;
  transition: all .2s;
  box-shadow: 0 2px 8px rgba(245,158,11,.25);
}

.vibeimg-configure-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(245,158,11,.35);
}

/* Error accents */
.vibeimg-error-auth    { background: #fffbeb; }
.vibeimg-error-auth    .vibeimg-error-badge { background: rgba(245,158,11,.12); }
.vibeimg-error-network { background: #fff7ed; }
.vibeimg-error-network .vibeimg-error-badge { background: rgba(249,115,22,.12); }
.vibeimg-error-api     { background: #fef2f2; }
.vibeimg-error-api     .vibeimg-error-badge { background: rgba(239,68,68,.12); }
.vibeimg-error-timeout { background: #eff6ff; }
.vibeimg-error-timeout .vibeimg-error-badge { background: rgba(59,130,246,.12); }
.vibeimg-error-config  { background: #f5f3ff; }
.vibeimg-error-config  .vibeimg-error-badge { background: rgba(139,92,246,.12); }
.vibeimg-error-unknown { background: #f9fafb; }
.vibeimg-error-unknown .vibeimg-error-badge { background: rgba(107,114,128,.12); }

@keyframes vibeimg-fadein {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}
`;