# vibe-img API Reference

## Attributes

| Attribute | Values | Default | Description |
|-----------|--------|---------|-------------|
| `model` | `openai`, `recraft` | — | **Required.** Provider to use. |
| `prompt` | string | — | Text prompt. Required for `generate`, `img2img`, `replace-bg`. |
| `op` | `generate`, `img2img`, `upscale`, `remove-bg`, `replace-bg`, `vectorize` | `generate` | Operation to perform. |
| `aspect` | `square`, `landscape`, `portrait`, `wide`, `tall` | `square` | Output aspect ratio. |
| `img-style` | See Styles below | — | Visual style (universal, works on any provider). |
| `quality` | `draft`, `standard`, `hd` | `standard` | Generation quality. |
| `format` | `png`, `webp`, `jpeg` | provider default | Output format. Recraft falls back `jpeg` → `png`. |
| `img-ref` | URL or `#id` | — | Reference image for editing ops. |
| `seed` | integer | — | Reproducible generation (provider support varies). |
| `negative-prompt` | string | — | What to avoid (Recraft native, OpenAI ignores). |
| `params` | JSON string | — | Raw provider API params, merged last. |
| `alt` | string | — | Alt text for accessibility. |

**Note:** `model` selects the provider. To override the API model within a provider, use `params='{"model":"recraftv4"}'`.

## Operations

| Operation | Required attrs | Provider support |
|-----------|---------------|-----------------|
| `generate` | `prompt` | openai ✓, recraft ✓ |
| `img2img` | `prompt`, `img-ref` | openai ✓, recraft ✓ |
| `upscale` | `img-ref` | recraft only |
| `remove-bg` | `img-ref` | recraft only |
| `replace-bg` | `prompt`, `img-ref` | openai ✓, recraft ✓ |
| `vectorize` | `img-ref` | recraft only |

## Universal styles

Use these as `img-style` values. They map to native provider styles where available, otherwise injected into prompt.

**Photorealistic:** `realistic`, `natural`, `vivid`, `cinematic`
**Illustration:** `illustration`, `3d`, `pixel`, `sketch`, `watercolor`, `oil-painting`, `comic`, `retro`, `neon`, `fantasy`, `abstract`, `anime`, `kawaii`, `isometric`
**Vector:** `vector`, `minimalist`, `flat`, `icon`, `logo`

Do NOT use provider-specific style names in `img-style`. Those go in `params`:
```html
<vibe-img model="recraft" prompt="city" params='{"style":"Neon Calm"}'></vibe-img>
```

## Aspect ratios

| Value | Use for |
|-------|---------|
| `square` | Avatars, icons, product cards |
| `landscape` | Hero sections, blog covers, cards |
| `portrait` | Mobile heroes, posters, tall cards |
| `wide` | Full-width banners, backgrounds |
| `tall` | Mobile backgrounds, story format |

## Provider-specific params examples

```html
<!-- OpenAI: transparent background -->
<vibe-img model="openai" prompt="app icon" format="png"
  params='{"background":"transparent"}'></vibe-img>

<!-- OpenAI: compressed WebP -->
<vibe-img model="openai" prompt="hero" format="webp"
  params='{"output_compression":85}'></vibe-img>

<!-- Recraft: brand colors -->
<vibe-img model="recraft" prompt="brand illustration"
  params='{"controls":{"colors":[{"rgb":[45,55,72]},{"rgb":[99,179,237]}]}}'></vibe-img>

<!-- Recraft: V4 model -->
<vibe-img model="recraft" prompt="modern chair"
  params='{"model":"recraftv4"}'></vibe-img>

<!-- Recraft: custom style ID -->
<vibe-img model="recraft" prompt="product photo"
  params='{"style_id":"your-custom-style-id"}'></vibe-img>
```

## `<vibe-theme>`

Wraps multiple `<vibe-img>` elements. Theme prompt is appended to each child's prompt.

```html
<vibe-theme prompt="warm editorial, soft lighting, muted earth tones">
  <vibe-img model="recraft" prompt="coffee cup"></vibe-img>
  <vibe-img model="recraft" prompt="open notebook"></vibe-img>
</vibe-theme>
```

Closest ancestor wins on nesting. Use for card grids, feature sections, galleries.

## Image references

```html
<vibe-img id="hero" model="recraft" prompt="mountain lake" img-style="illustration"></vibe-img>
<vibe-img model="recraft" op="img2img" img-ref="#hero" prompt="same scene at dusk"></vibe-img>
```

`img-ref` accepts `#id` (pointing to another `<vibe-img>`) or a direct URL.


## Common mistakes

| Wrong | Right | Why |
|-------|-------|-----|
| `<vibe-img ... />` | `<vibe-img ...></vibe-img>` | Self-closing breaks DOM |
| `img-style="Pixel art"` | `img-style="pixel"` | Use universal names, not provider-specific |
| `model="openai" op="upscale"` | `model="recraft" op="upscale"` | Upscale is recraft-only |
| Style in `prompt` | Use `img-style` attribute | Keeps prompt focused on content |
| No `<vibe-theme>` for grids | Wrap in `<vibe-theme>` | Without it, images look inconsistent |
| Changing attrs for CSS fixes | Only change attrs to change the image | Any change regenerates |