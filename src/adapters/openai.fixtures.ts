import { TestFixture } from './types';

const BASE = 'https://api.openai.com';

export const openaiFixtures: TestFixture[] = [
    // ══════════════════════════════════════════════════════════════════════
    // GENERATE
    // ══════════════════════════════════════════════════════════════════════
    {
      name: 'generate: defaults',
      input: { prompt: 'a dog' },
      expect: {
        url: `${BASE}/v1/images/generations`,
        contentType: 'json',
        bodyIncludes: {
          prompt: 'a dog',
          model: 'gpt-image-1.5',
          size: '1024x1024',
          quality: 'auto',
        },
        bodyExcludes: ['style'],
      },
    },
    {
      name: 'generate: aspect wide → 1536x1024',
      input: { prompt: 'sunset', aspect: 'wide' },
      expect: { bodyIncludes: { size: '1536x1024' } },
    },
    {
      name: 'generate: aspect tall → 1024x1536',
      input: { prompt: 'poster', aspect: 'tall' },
      expect: { bodyIncludes: { size: '1024x1536' } },
    },
    {
      name: 'generate: aspect landscape → 1536x1024',
      input: { prompt: 'photo', aspect: 'landscape' },
      expect: { bodyIncludes: { size: '1536x1024' } },
    },
    {
      name: 'generate: aspect portrait → 1024x1536',
      input: { prompt: 'shot', aspect: 'portrait' },
      expect: { bodyIncludes: { size: '1024x1536' } },
    },
    // ── Quality mapping ──
    {
      name: 'generate: quality draft → low',
      input: { prompt: 'test', quality: 'draft' },
      expect: { bodyIncludes: { quality: 'low' } },
    },
    {
      name: 'generate: quality standard → auto',
      input: { prompt: 'test', quality: 'standard' },
      expect: { bodyIncludes: { quality: 'auto' } },
    },
    {
      name: 'generate: quality hd → high',
      input: { prompt: 'test', quality: 'hd' },
      expect: { bodyIncludes: { quality: 'high' } },
    },
    // ── Style: ALWAYS in prompt, never as param ──
    {
      name: 'generate: any style → injected in prompt, no style param',
      input: { prompt: 'a castle', style: 'anime' },
      expect: {
        promptIncludes: 'anime',
        bodyExcludes: ['style'],
      },
    },
    {
      name: 'generate: "vivid" style → in prompt (not param, GPT Image has no style)',
      input: { prompt: 'a cat', style: 'vivid' },
      expect: {
        promptIncludes: 'vivid',
        bodyExcludes: ['style'],
      },
    },
    {
      name: 'generate: "natural" style → in prompt',
      input: { prompt: 'a dog', style: 'natural' },
      expect: {
        promptIncludes: 'natural',
        bodyExcludes: ['style'],
      },
    },
    // ── Format ──
    {
      name: 'generate: format png → output_format png',
      input: { prompt: 'test', format: 'png' },
      expect: { bodyIncludes: { output_format: 'png' } },
    },
    {
      name: 'generate: format webp → output_format webp',
      input: { prompt: 'test', format: 'webp' },
      expect: { bodyIncludes: { output_format: 'webp' } },
    },
    {
      name: 'generate: format jpeg → output_format jpeg',
      input: { prompt: 'test', format: 'jpeg' },
      expect: { bodyIncludes: { output_format: 'jpeg' } },
    },
    {
      name: 'generate: format absent → no output_format key',
      input: { prompt: 'test' },
      expect: { bodyExcludes: ['output_format'] },
    },
    // ── rawParams ──
    {
      name: 'generate: rawParams background transparent',
      input: { prompt: 'logo', format: 'png', rawParams: { background: 'transparent' } },
      expect: {
        bodyIncludes: { background: 'transparent', output_format: 'png' },
      },
    },
    {
      name: 'generate: rawParams output_compression',
      input: { prompt: 'test', format: 'webp', rawParams: { output_compression: 50 } },
      expect: {
        bodyIncludes: { output_compression: 50, output_format: 'webp' },
      },
    },
    {
      name: 'generate: rawParams moderation low',
      input: { prompt: 'test', rawParams: { moderation: 'low' } },
      expect: {
        bodyIncludes: { moderation: 'low' },
      },
    },
    {
      name: 'generate: rawParams model override',
      input: { prompt: 'test', rawParams: { model: 'gpt-image-1' } },
      expect: {
        bodyIncludes: { model: 'gpt-image-1' },
      },
    },
    {
      name: 'generate: rawParams quality medium (not in universal Quality type)',
      input: { prompt: 'test', rawParams: { quality: 'medium' } },
      expect: {
        bodyIncludes: { quality: 'medium' },
      },
    },

    // ══════════════════════════════════════════════════════════════════════
    // IMG2IMG (edits endpoint)
    // ══════════════════════════════════════════════════════════════════════
    {
      name: 'img2img: defaults',
      input: { prompt: 'add snow' },
      op: 'img2img',
      expect: {
        url: `${BASE}/v1/images/edits`,
        contentType: 'multipart',
        bodyIncludes: {
          model: 'gpt-image-1.5',
          prompt: 'add snow',
          size: '1024x1024',
          quality: 'auto',
        },
        bodyExcludes: ['style'],
      },
    },
    {
      name: 'img2img: style goes in prompt',
      input: { prompt: 'restyle', style: 'watercolor' },
      op: 'img2img',
      expect: {
        promptIncludes: 'watercolor',
        bodyExcludes: ['style'],
      },
    },
    {
      name: 'img2img: format + quality',
      input: { prompt: 'edit', format: 'webp', quality: 'hd' },
      op: 'img2img',
      expect: {
        bodyIncludes: { output_format: 'webp', quality: 'high' },
      },
    },

    // ══════════════════════════════════════════════════════════════════════
    // REPLACE-BG (edits endpoint with prefix)
    // ══════════════════════════════════════════════════════════════════════
    {
      name: 'replace-bg: prefixes prompt',
      input: { prompt: 'a beach sunset' },
      op: 'replace-bg',
      expect: {
        url: `${BASE}/v1/images/edits`,
        contentType: 'multipart',
        promptIncludes: 'Replace the background',
      },
    },
    {
      name: 'replace-bg: style in prompt, no style param',
      input: { prompt: 'forest scene', style: 'realistic' },
      op: 'replace-bg',
      expect: {
        promptIncludes: 'realistic',
        bodyExcludes: ['style'],
      },
    },
    {
      name: 'replace-bg: transparent bg via rawParams',
      input: { prompt: 'clean bg', format: 'png', rawParams: { background: 'transparent' } },
      op: 'replace-bg',
      expect: {
        bodyIncludes: { background: 'transparent' },
      },
    },
  ];