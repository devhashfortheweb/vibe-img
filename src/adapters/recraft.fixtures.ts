import { TestFixture } from './types';

const BASE = 'https://external.api.recraft.ai';

export const recraftFixtures: TestFixture[] = [
    // ══════════════════════════════════════════════════════════════════════
    // GENERATE
    // ══════════════════════════════════════════════════════════════════════
    {
      name: 'generate: defaults (recraftv3, 1:1, block_nsfw)',
      input: { prompt: 'a logo' },
      expect: {
        url: `${BASE}/v1/images/generations`,
        contentType: 'json',
        bodyIncludes: {
          prompt: 'a logo',
          model: 'recraftv3',
          size: '1:1',
          response_format: 'url',
          block_nsfw: true,
        },
      },
    },
    {
      name: 'generate: aspect wide → 16:9',
      input: { prompt: 'banner', aspect: 'wide' },
      expect: { bodyIncludes: { size: '16:9' } },
    },
    {
      name: 'generate: aspect tall → 9:16',
      input: { prompt: 'poster', aspect: 'tall' },
      expect: { bodyIncludes: { size: '9:16' } },
    },
    {
      name: 'generate: aspect landscape → 4:3',
      input: { prompt: 'photo', aspect: 'landscape' },
      expect: { bodyIncludes: { size: '4:3' } },
    },
    {
      name: 'generate: aspect portrait → 3:4',
      input: { prompt: 'shot', aspect: 'portrait' },
      expect: { bodyIncludes: { size: '3:4' } },
    },
    {
      name: 'generate: seed → random_seed',
      input: { prompt: 'test', seed: 42 },
      expect: { bodyIncludes: { random_seed: 42 } },
    },
    {
      name: 'generate: seed absent → no random_seed key',
      input: { prompt: 'test' },
      expect: { bodyExcludes: ['random_seed'] },
    },

    // ── Style: universal short names → new V3 flat names ──
    {
      name: 'generate: universal "pixel" → Pixel art',
      input: { prompt: 'game sprite', style: 'pixel' },
      expect: {
        bodyIncludes: { style: 'Pixel art', prompt: 'game sprite' },
        bodyExcludes: ['substyle'],
      },
    },
    {
      name: 'generate: universal "realistic" → Photorealism',
      input: { prompt: 'a cat', style: 'realistic' },
      expect: {
        bodyIncludes: { style: 'Photorealism', prompt: 'a cat' },
        bodyExcludes: ['substyle'],
      },
    },
    {
      name: 'generate: universal "sketch" → Pencil sketch',
      input: { prompt: 'dog', style: 'sketch' },
      expect: {
        bodyIncludes: { style: 'Pencil sketch' },
        bodyExcludes: ['substyle'],
      },
    },

    // ── Style: direct Recraft names → via raw-params only ──
    {
      name: 'generate: non-universal "Hand-drawn" → injected into prompt',
      input: { prompt: 'monster', style: 'Hand-drawn' },
      expect: {
        promptIncludes: 'Hand-drawn',
        bodyExcludes: ['style', 'substyle'],
      },
    },

    // ── Style: Recraft-specific via rawParams ──
    {
      name: 'generate: rawParams style override (Recraft-native)',
      input: { prompt: 'city', rawParams: { style: 'Neon Calm' } },
      expect: {
        bodyIncludes: { style: 'Neon Calm' },
      },
    },

    // ── Style: vector → auto-switches model ──
    {
      name: 'generate: universal "vector" → Vector art + recraftv3_vector',
      input: { prompt: 'icon set', style: 'vector' },
      expect: {
        bodyIncludes: { style: 'Vector art', model: 'recraftv3_vector' },
      },
    },
    {
      name: 'generate: universal "minimalist" → Line art + recraftv3_vector',
      input: { prompt: 'sketch', style: 'minimalist' },
      expect: {
        bodyIncludes: { style: 'Line art', model: 'recraftv3_vector' },
      },
    },
    {
      name: 'generate: universal "flat" → Roundish flat + recraftv3_vector',
      input: { prompt: 'design', style: 'flat' },
      expect: {
        bodyIncludes: { style: 'Roundish flat', model: 'recraftv3_vector' },
      },
    },

    // ── Style: non-native → injected into prompt ──
    {
      name: 'generate: "anime" (no Recraft equivalent) → injected into prompt',
      input: { prompt: 'a castle', style: 'anime' },
      expect: {
        promptIncludes: 'anime',
        bodyExcludes: ['style', 'substyle'],
      },
    },
    {
      name: 'generate: "isometric" (no Recraft equivalent) → injected into prompt',
      input: { prompt: 'a room', style: 'isometric' },
      expect: {
        promptIncludes: 'isometric',
        bodyExcludes: ['style', 'substyle'],
      },
    },
    {
      name: 'generate: "kawaii" (no Recraft equivalent) → injected into prompt',
      input: { prompt: 'a cat', style: 'kawaii' },
      expect: {
        promptIncludes: 'kawaii',
        bodyExcludes: ['style', 'substyle'],
      },
    },
    {
      name: 'generate: universal "oil-painting" → Freehand details',
      input: { prompt: 'landscape', style: 'oil-painting' },
      expect: {
        bodyIncludes: { style: 'Freehand details' },
        bodyExcludes: ['substyle'],
      },
    },
    {
      name: 'generate: universal "cinematic" → Evening light',
      input: { prompt: 'scene', style: 'cinematic' },
      expect: {
        bodyIncludes: { style: 'Evening light' },
        bodyExcludes: ['substyle'],
      },
    },
    {
      name: 'generate: universal "abstract" → Expressionism',
      input: { prompt: 'shapes', style: 'abstract' },
      expect: {
        bodyIncludes: { style: 'Expressionism' },
        bodyExcludes: ['substyle'],
      },
    },
    {
      name: 'generate: universal "logo" → Vector art + recraftv3_vector',
      input: { prompt: 'tech company', style: 'logo' },
      expect: {
        bodyIncludes: { style: 'Vector art', model: 'recraftv3_vector' },
      },
    },
    {
      name: 'generate: universal "watercolor" → Pastel sketch',
      input: { prompt: 'flowers', style: 'watercolor' },
      expect: {
        bodyIncludes: { style: 'Pastel sketch' },
        bodyExcludes: ['substyle'],
      },
    },

    // ── V4: no style param, inject into prompt ──
    {
      name: 'generate: V4 + style → injected into prompt, no style param',
      input: { prompt: 'game sprite', style: 'pixel', rawParams: { model: 'recraftv4' } },
      expect: {
        bodyIncludes: { model: 'recraftv4' },
        promptIncludes: 'Pixel art',
        bodyExcludes: ['style', 'substyle'],
      },
    },

    // ── Other params ──
    {
      name: 'generate: negative_prompt',
      input: { prompt: 'a dog', negativePrompt: 'blurry, text' },
      expect: { bodyIncludes: { negative_prompt: 'blurry, text' } },
    },
    {
      name: 'generate: negativePrompt absent → no key',
      input: { prompt: 'a dog' },
      expect: { bodyExcludes: ['negative_prompt'] },
    },
    {
      name: 'generate: format webp → image_format webp',
      input: { prompt: 'test', format: 'webp' },
      expect: { bodyIncludes: { image_format: 'webp' } },
    },
    {
      name: 'generate: format png → image_format png',
      input: { prompt: 'test', format: 'png' },
      expect: { bodyIncludes: { image_format: 'png' } },
    },
    {
      name: 'generate: format jpeg → falls back to png',
      input: { prompt: 'test', format: 'jpeg' },
      expect: { bodyIncludes: { image_format: 'png' } },
    },
    {
      name: 'generate: format absent → no image_format key',
      input: { prompt: 'test' },
      expect: { bodyExcludes: ['image_format'] },
    },
    {
      name: 'generate: rawParams model override',
      input: { prompt: 'test', rawParams: { model: 'recraftv4_pro' } },
      expect: { bodyIncludes: { model: 'recraftv4_pro' } },
    },
    {
      name: 'generate: rawParams controls (brand colors)',
      input: {
        prompt: 'icon',
        rawParams: { controls: { colors: [{ rgb: [46, 125, 50] }] } },
      },
      expect: {
        bodyIncludes: { controls: { colors: [{ rgb: [46, 125, 50] }] } },
      },
    },
    {
      name: 'generate: rawParams style_id (custom style)',
      input: {
        prompt: 'test',
        rawParams: { style_id: '550e8400-e29b-41d4-a716-446655440000' },
      },
      expect: {
        bodyIncludes: { style_id: '550e8400-e29b-41d4-a716-446655440000' },
      },
    },

    // ══════════════════════════════════════════════════════════════════════
    // IMG2IMG
    // ══════════════════════════════════════════════════════════════════════
    {
      name: 'img2img: defaults (recraftv3, strength 0.5)',
      input: { prompt: 'add snow' },
      op: 'img2img',
      expect: {
        url: `${BASE}/v1/images/imageToImage`,
        contentType: 'multipart',
        bodyIncludes: {
          prompt: 'add snow',
          model: 'recraftv3',
          strength: 0.5,
          response_format: 'url',
          block_nsfw: true,
        },
      },
    },
    {
      name: 'img2img: style applied as flat name',
      input: { prompt: 'restyle', style: 'pixel' },
      op: 'img2img',
      expect: {
        bodyIncludes: { style: 'Pixel art' },
        bodyExcludes: ['substyle'],
      },
    },
    {
      name: 'img2img: non-native style → in prompt',
      input: { prompt: 'restyle', style: 'anime' },
      op: 'img2img',
      expect: {
        promptIncludes: 'anime',
        bodyExcludes: ['style', 'substyle'],
      },
    },
    {
      name: 'img2img: seed → random_seed',
      input: { prompt: 'edit', seed: 123 },
      op: 'img2img',
      expect: { bodyIncludes: { random_seed: 123 } },
    },
    {
      name: 'img2img: negative_prompt',
      input: { prompt: 'edit', negativePrompt: 'noise' },
      op: 'img2img',
      expect: { bodyIncludes: { negative_prompt: 'noise' } },
    },
    {
      name: 'img2img: format → image_format',
      input: { prompt: 'edit', format: 'webp' },
      op: 'img2img',
      expect: { bodyIncludes: { image_format: 'webp' } },
    },
    {
      name: 'img2img: V4 + style → injected into prompt, no style param',
      input: { prompt: 'add glow', style: 'pixel', rawParams: { model: 'recraftv4' } },
      op: 'img2img',
      expect: {
        bodyIncludes: { model: 'recraftv4' },
        promptIncludes: 'Pixel art',
        bodyExcludes: ['style', 'substyle'],
      },
    },

    // ══════════════════════════════════════════════════════════════════════
    // REPLACE-BG
    // ══════════════════════════════════════════════════════════════════════
    {
      name: 'replace-bg: defaults (recraftv3)',
      input: { prompt: 'sunset beach' },
      op: 'replace-bg',
      expect: {
        url: `${BASE}/v1/images/replaceBackground`,
        contentType: 'multipart',
        bodyIncludes: {
          prompt: 'sunset beach',
          model: 'recraftv3',
          response_format: 'url',
          block_nsfw: true,
        },
        bodyExcludes: ['strength', 'controls'],
      },
    },
    {
      name: 'replace-bg: style + seed + negative_prompt',
      input: { prompt: 'forest', style: 'realistic', seed: 77, negativePrompt: 'people' },
      op: 'replace-bg',
      expect: {
        bodyIncludes: {
          style: 'Photorealism',
          random_seed: 77,
          negative_prompt: 'people',
        },
      },
    },
    {
      name: 'replace-bg: V4 + style → injected into prompt, no style param',
      input: { prompt: 'neon city', style: 'neon', rawParams: { model: 'recraftv4' } },
      op: 'replace-bg',
      expect: {
        bodyIncludes: { model: 'recraftv4' },
        promptIncludes: 'Neon Calm',
        bodyExcludes: ['style', 'substyle'],
      },
    },

    // ══════════════════════════════════════════════════════════════════════
    // UPSCALE
    // ══════════════════════════════════════════════════════════════════════
    {
      name: 'upscale: defaults',
      input: {},
      op: 'upscale',
      expect: {
        url: `${BASE}/v1/images/crispUpscale`,
        contentType: 'multipart',
        bodyIncludes: { response_format: 'url' },
      },
    },
    {
      name: 'upscale: image_format',
      input: { format: 'webp' },
      op: 'upscale',
      expect: { bodyIncludes: { image_format: 'webp' } },
    },

    // ══════════════════════════════════════════════════════════════════════
    // REMOVE-BG
    // ══════════════════════════════════════════════════════════════════════
    {
      name: 'remove-bg: defaults',
      input: {},
      op: 'remove-bg',
      expect: {
        url: `${BASE}/v1/images/removeBackground`,
        contentType: 'multipart',
        bodyIncludes: { response_format: 'url' },
      },
    },

    // ══════════════════════════════════════════════════════════════════════
    // VECTORIZE
    // ══════════════════════════════════════════════════════════════════════
    {
      name: 'vectorize: defaults',
      input: {},
      op: 'vectorize',
      expect: {
        url: `${BASE}/v1/images/vectorize`,
        contentType: 'multipart',
        bodyIncludes: { response_format: 'url' },
      },
    },
  ];