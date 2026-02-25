// VibeTheme.tsx — <vibe-theme> custom element.
//
// Invisible container (display: contents) that injects a style prompt into
// all descendant <vibe-img> elements. Closest ancestor wins on nesting.
//
// Usage:
//   <vibe-theme prompt="warm editorial, soft lighting, muted earth tones">
//     <vibe-img model="recraft" prompt="coffee cup"></vibe-img>
//
//     <vibe-theme prompt="dark cinematic, dramatic shadows">
//       <vibe-img model="recraft" prompt="whiskey glass"></vibe-img>
//     </vibe-theme>
//   </vibe-theme>

export class VibeThemeElement extends HTMLElement {
  static get observedAttributes() { return ['prompt']; }

  connectedCallback() {
    this.style.display = 'contents';
    this.notify();
  }

  attributeChangedCallback(_name: string, oldVal: string, newVal: string) {
    if (oldVal !== newVal) this.notify();
  }

  private notify() {
    this.dispatchEvent(new CustomEvent('vibeimg:themechange', { bubbles: true }));
  }
}

export function registerVibeTheme() {
  if (typeof customElements !== 'undefined' && !customElements.get('vibe-theme')) {
    customElements.define('vibe-theme', VibeThemeElement);
  }
}
