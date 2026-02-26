# vibe-img — LLM Builder Reference

Use this document to generate correct, optimized `<vibe-img>` tags when building websites.

---

## Core concept

`<vibe-img>` is a web component that generates AI images at page load.
Images are cached — they only generate once, then served from cache on every subsequent load.

> ⚠️ **Always use a closing tag.** `<vibe-img />` does **not** work — the HTML parser treats custom elements as open tags when self-closed, swallowing all sibling elements. Always write `<vibe-img ...></vibe-img>`. Same for `<vibe-theme></vibe-theme>`.

**One rule — cached by default, until you change an attribute.**

Every attribute on a `<vibe-img>` tag is hashed into a cache key. The image generates once, then is served from cache on every subsequent load — across users, devices, and sessions.

This means:

- Write the best possible attributes the first time. Vague prompts cache vague images permanently.
- If the user asks for HTML/CSS changes only, **do not touch `<vibe-img>` attributes**. Changing even one character in `prompt`, `img-style`, `aspect`, or `params` triggers a full regeneration and discards the cached image.
- If the user explicitly asks to regenerate or improve an image, then change the attributes — but do so intentionally, not as a side effect of refactoring.

In practice: treat `<vibe-img>` attributes like database records. You wouldn't mutate a database row to fix a CSS bug.

---

## Before you start: API keys

`<vibe-img>` requires an API key from the chosen provider. The user must have their own key — the library does not provide one.

**Always ask the user which provider they want to use before generating any `<vibe-img>` tags.** If they don't specify, ask which API key they have:

- **OpenAI key** (`sk-...`) → use `model="openai"`
- **Recraft key** → use `model="recraft"`

If the user has both keys, choose the provider that best fits the task (see [Decision guide](#decision-guide)).

If the user has never used vibe-img before, they'll see a key configuration modal on first load. **This is the recommended approach** — it avoids leaking API keys in LLM conversation history, prompts, or generated code. Never hardcode API keys in HTML.

Keys can also be configured programmatically if needed, but prefer the modal:

```js
// Only if the modal isn't suitable (e.g. automated setups)
await VibeImg.configure({
  openai:  'sk-...',
  recraft: 'rk-...',
});
```

---

## Script tag

```html
<script src="https://cdn.jsdelivr.net/npm/vibe-img@1.0.0/dist/vibeimg.js"></script>
```

---

## Attributes reference

### `model` (required)

Which AI provider to use.

| Value | Best for |
|-------|----------|
| `recraft` | Illustrations, icons, SVG, brand imagery, style control, upscaling |
| `openai` | Photorealistic images, complex scene editing, image-to-image |

### `prompt` (required for most ops)

Describe the image. Be specific: include subject, lighting, composition, mood.

### `op` (default: `generate`)

| Value | Required attrs | Description |
|-------|----------------|-------------|
| `generate` | `prompt` | Text to image |
| `img2img` | `prompt`, `img-ref` | Edit an existing image with a prompt |
| `upscale` | `img-ref` | Increase resolution (recraft only) |
| `remove-bg` | `img-ref` | Remove background → transparent PNG (recraft only) |
| `replace-bg` | `prompt`, `img-ref` | Replace background with prompt |
| `vectorize` | `img-ref` | Convert to SVG (recraft only) |

### `aspect` (default: `square`)

| Value | Use for |
|-------|---------|
| `square` | Avatars, icons, product cards |
| `landscape` | Hero sections, blog covers, cards |
| `portrait` | Mobile heroes, posters, tall cards |
| `wide` | Full-width banners, backgrounds |
| `tall` | Mobile backgrounds, story format |

### `img-style`

Universal styles that work with **any provider**. Where a provider has native style support (Recraft), these map to it automatically. Where it doesn't (OpenAI), they're injected into the prompt.

| Value | Description |
|-------|-------------|
| `realistic` | Photorealistic photography |
| `natural` | Soft natural lighting |
| `vivid` | HDR, dramatic lighting |
| `cinematic` | Film still, cinematic mood |
| `illustration` | Digital illustration |
| `3d` | 3D rendered / clay style |
| `pixel` | Retro pixel art |
| `sketch` | Pencil sketch |
| `watercolor` | Watercolor painting |
| `oil-painting` | Oil painting |
| `comic` | Comic book style |
| `retro` | Retro vintage |
| `neon` | Neon glow, dark background |
| `fantasy` | Fantasy art |
| `abstract` | Abstract / expressionist |
| `anime` | Anime style |
| `kawaii` | Cute kawaii style |
| `isometric` | Isometric view |
| `vector` | Clean vector illustration |
| `minimalist` | Minimal line art |
| `flat` | Flat design |
| `icon` | App icon, simple and clean |
| `logo` | Logo design, professional |

**These are the only values you should use for `img-style`.** Do not use provider-specific style names (like Recraft's `"Pixel art"` or `"Neon Calm"`) in this attribute — those go in `params` if needed.

### `quality` (default: `standard`)

| Value | Speed | Use for |
|-------|-------|---------|
| `draft` | Fast | Prototyping, low-priority images |
| `standard` | Medium | Most use cases |
| `hd` | Slow | Hero images, key visuals |

### `format`

Output image format. If omitted, the provider's default is used.

| Value | Notes |
|-------|-------|
| `png` | Best for transparency (use with `remove-bg` or OpenAI `background: transparent`) |
| `webp` | Smaller file size, good for web |
| `jpeg` | Broad compatibility (Recraft falls back to `png` — jpeg not supported by their API) |

### `negative-prompt`

What to avoid in the generated image. Provider support varies — Recraft supports it natively, OpenAI ignores it.

```html
<vibe-img model="recraft" prompt="a forest clearing" negative-prompt="people, text, watermark"></vibe-img>
```

### `img-ref`

Reference image for `img2img`, `upscale`, `remove-bg`, `replace-bg`, `vectorize`.
Can be a #id reference (`#my-img`) pointing to another `<vibe-img>`, or a direct URL.

```html
<vibe-img id="hero" model="recraft" prompt="mountain lake at dawn" img-style="illustration"></vibe-img>
<vibe-img model="recraft" op="img2img" img-ref="#hero" prompt="same scene at dusk, warm orange tones"></vibe-img>
```

### `seed`

Integer. Fix a specific seed for reproducible results. Provider support varies.

### `params`

Raw JSON string for **provider-specific** parameters not covered by universal attributes. These are passed directly to the provider's API — consult the provider's documentation for available options:

- **OpenAI**: [Images API reference](https://platform.openai.com/docs/api-reference/images)
- **Recraft**: [API reference](https://www.recraft.ai/docs/api-reference/endpoints)

```html
<!-- OpenAI: transparent background (PNG only) -->
<vibe-img model="openai" prompt="app icon" format="png"
  params='{"background":"transparent"}'></vibe-img>

<!-- OpenAI: compressed WebP -->
<vibe-img model="openai" prompt="hero image" format="webp"
  params='{"output_compression":85}'></vibe-img>

<!-- Recraft: brand color palette -->
<vibe-img model="recraft" prompt="brand illustration"
  params='{"controls":{"colors":[{"rgb":[45,55,72]},{"rgb":[99,179,237]}]}}'></vibe-img>

<!-- Recraft: provider-specific style (not a universal style) -->
<vibe-img model="recraft" prompt="city at night"
  params='{"style":"Neon Calm"}'></vibe-img>

<!-- Recraft: custom style ID from Recraft platform -->
<vibe-img model="recraft" prompt="product photo"
  params='{"style_id":"your-custom-style-id"}'></vibe-img>

<!-- Recraft: use V4 model -->
<vibe-img model="recraft" prompt="modern chair"
  params='{"model":"recraftv4"}'></vibe-img>
```

### `alt`

Alt text for accessibility. Always set for meaningful images.

---

## Provider capability matrix

| Operation | `openai` | `recraft` |
|-----------|----------|-----------|
| `generate` | ✓ | ✓ |
| `img2img` | ✓ | ✓ |
| `upscale` | — | ✓ |
| `remove-bg` | — | ✓ |
| `replace-bg` | ✓ | ✓ |
| `vectorize` | — | ✓ |

---

## `<vibe-theme>` — shared style for a group

Wrap multiple `<vibe-img>` elements in `<vibe-theme>` to apply a shared style prompt to all of them. The theme prompt is **appended** to each individual prompt. Write it as a style/rendering description, not a subject description.

```html
<vibe-theme prompt="isometric diorama, clay style, soft studio lighting, pastel palette">
  <vibe-img model="recraft" prompt="small coffee shop" aspect="square" img-style="3d"></vibe-img>
  <vibe-img model="recraft" prompt="city park with fountain" aspect="square" img-style="3d"></vibe-img>
  <vibe-img model="recraft" prompt="home library with armchair" aspect="square" img-style="3d"></vibe-img>
</vibe-theme>
```

Use `<vibe-theme>` whenever 2+ images on the page should share a visual style — card grids, feature sections, gallery layouts.

---

## Decision guide

**What provider should I use?**

- Photorealistic photos → `recraft` with `img-style="realistic"` or `openai`
- Illustrations, icons, brand imagery → `recraft`
- Transparent background → `recraft` with `op="remove-bg"`, or `openai` with `params='{"background":"transparent"}' format="png"`
- SVG output → `recraft` with `op="vectorize"`
- Upscaling → `recraft` with `op="upscale"`

**How should I write prompts?**

1. Subject first: what is in the image
2. Then context: where, when, lighting conditions
3. Then composition: angle, framing, focal point
4. Style goes in `img-style`, **not** in the prompt — unless you need something very specific that isn't a universal style

**Which aspect should I use?**

- Full-width hero → `wide`
- Side-by-side cards → `landscape`
- Mobile-first hero → `portrait` or `tall`
- Feature icons or avatars → `square`

---

## Complete page example

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <script src="https://cdn.jsdelivr.net/npm/vibe-img@1.0.0/dist/vibeimg.js"></script>
  <style>
    body { background: #FFD700; margin: 0; font-family: system-ui, sans-serif; }
    .features-row { display: flex; gap: 2rem; justify-content: center; flex-wrap: wrap; }
    .feature { text-align: center; }
    .feature-circle { width: 160px; height: 160px; border-radius: 50%; border: 3px solid #034C53; overflow: hidden; }
    .feature-circle vibe-img { width: 100%; height: 100%; }
    .feature-name { font-weight: 900; margin-top: 0.5rem; }
    .feature-desc { font-size: 0.85rem; opacity: 0.7; }
    .page-header { text-align: center; padding: 2rem; }
    .page-title { font-size: 2rem; font-weight: 900; }
    .theme-tag { font-size: 0.8rem; background: #034C53; color: #FFD700; display: inline-block; padding: 0.3rem 0.8rem; border-radius: 4px; }
  </style>
</head>
<body>

  <vibe-theme prompt="retro travel poster illustration, bold dark outlines, flat color fills, relaxed chill mood, round composition fitting a circle. Set in Yosemite National Park">
    <div class="page-header">
      <div>Open source</div>
      <h1 class="page-title">One tag to <em>generate them all.</em></h1>
      <p>AI images in your HTML. Drop a tag, pick a provider, ship.</p>
      <div class="theme-tag">vibe-theme — consistent style</div>
    </div>

    <div class="features-row">
      <div class="feature">
        <div class="feature-circle">
          <vibe-img
            model="recraft"
            img-style="vector"
            prompt="a man holding a lit torch walking through Yosemite valley at night, granite cliffs, stars above"
            aspect="square"
            params='{"controls":{"colors":[{"rgb":[255,215,0]},{"rgb":[243,140,121]},{"rgb":[3,76,83]},{"rgb":[0,112,116]}],"background_color":{"rgb":[243,140,121]}}}'
          ></vibe-img>
        </div>
        <div class="feature-name">One tag</div>
        <div class="feature-desc">&lt;vibe-img&gt; does the rest</div>
      </div>

      <div class="feature">
        <div class="feature-circle">
          <vibe-img
            model="recraft"
            img-style="vector"
            prompt="a forest trail splitting into two paths at sunset, tall pine trees, warm light through the branches"
            aspect="square"
            params='{"controls":{"colors":[{"rgb":[255,215,0]},{"rgb":[243,140,121]},{"rgb":[3,76,83]},{"rgb":[0,112,116]}],"background_color":{"rgb":[243,140,121]}}}'
          ></vibe-img>
        </div>
        <div class="feature-name">Any provider</div>
        <div class="feature-desc">Switch with one attribute</div>
      </div>

      <div class="feature">
        <div class="feature-circle">
          <vibe-img
            model="recraft"
            img-style="vector"
            prompt="an eagle soaring above Yosemite valley, Half Dome in the distance, open sky"
            aspect="square"
            params='{"controls":{"colors":[{"rgb":[255,215,0]},{"rgb":[243,140,121]},{"rgb":[3,76,83]},{"rgb":[0,112,116]}],"background_color":{"rgb":[243,140,121]}}}'
          ></vibe-img>
        </div>
        <div class="feature-name">Cached</div>
        <div class="feature-desc">Generate once, load instantly</div>
      </div>
    </div>
  </vibe-theme>

</body>
</html>
```

---

## Common mistakes

| Wrong | Right | Why |
|-------|-------|-----|
| `<vibe-img ... />` | `<vibe-img ...></vibe-img>` | Self-closing tags don't work on custom elements — siblings get swallowed |
| `img-style="realistic_image/studio_portrait"` | `img-style="realistic"` | Use universal style names, not provider-specific ones |
| `img-style="Pixel art"` | `img-style="pixel"` | Recraft-native names go in `params`, not `img-style` |
| `model="openai" op="upscale"` | `model="recraft" op="upscale"` | OpenAI does not support upscale |
| `model="openai" op="vectorize"` | `model="recraft" op="vectorize"` | Vectorize is recraft-only |
| Style words in `prompt` | Use `img-style` attribute | Keeps prompt focused on content, style is separate |
| No `<vibe-theme>` for card grids | Wrap card grids in `<vibe-theme>` | Without it, cards will have inconsistent styles |
| `quality="hd"` everywhere | `quality="hd"` only for hero/key visuals | HD is slower and costs more; use `standard` for secondary images |
| Changing attributes for CSS fixes | Only change attributes to change the image | Any attribute change regenerates and discards the cached image |