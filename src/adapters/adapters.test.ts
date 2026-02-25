// ==========================================================================
// adapters.test.ts — Tests every adapter against its own fixtures.
//
// Run:  npx vitest
// Watch: npx vitest --watch
//
// This file has ZERO knowledge of any specific provider.
// It iterates all adapters, runs their fixtures, done.
// ==========================================================================

import { describe, it, expect } from 'vitest';
import { builtinAdapters } from './index';
import { recraftFixtures } from './recraft.fixtures';
import { openaiFixtures } from './openai.fixtures';
import { TestFixture } from './types';

const fixtureMap: Record<string, TestFixture[]> = {
  recraft: recraftFixtures,
  openai: openaiFixtures,
};

/** Find the prompt string regardless of body structure */
function findPrompt(body: Record<string, any>): string | null {
  if (typeof body?.prompt === 'string')       return body.prompt;
  if (body?.instances?.[0]?.prompt)            return body.instances[0].prompt;
  if (typeof body?.input?.prompt === 'string') return body.input.prompt;
  return null;
}

/** Deep partial match: checks that `actual` contains all key/values from `expected` */
function expectPartialMatch(actual: any, expected: any, path = '') {
  if (expected === null || expected === undefined) return;

  if (Array.isArray(expected)) {
    expect(actual, `${path} should be array`).toBeInstanceOf(Array);
    expect(actual, `${path} array mismatch`).toEqual(expect.arrayContaining(expected));
    // Also check exact length for simple arrays
    if (expected.every((e: any) => typeof e !== 'object')) {
      expect(actual.length, `${path} array length`).toBe(expected.length);
    }
    return;
  }

  if (typeof expected === 'object') {
    for (const [key, val] of Object.entries(expected)) {
      const nextPath = path ? `${path}.${key}` : key;
      expect(actual, `${nextPath}: parent is ${actual}`).toBeDefined();
      expectPartialMatch(actual[key], val, nextPath);
    }
    return;
  }

  // Leaf value
  expect(actual, path).toBe(expected);
}

// --- Run all adapter fixtures as vitest cases ------------------------------

for (const adapter of builtinAdapters) {
  describe(adapter.id, () => {
    for (const fixture of fixtureMap[adapter.id] || []) {
      it(fixture.name, () => {
        const result = adapter.buildRequest(fixture.input, fixture.op);
        const { expect: exp } = fixture;

        // URL check (string or regex)
        if (exp.url) {
          if (exp.url instanceof RegExp) {
            expect(result.url).toMatch(exp.url);
          } else {
            expect(result.url).toBe(exp.url);
          }
        }

        // Content type
        if (exp.contentType) {
          expect(result.contentType).toBe(exp.contentType);
        }

        // Body includes (deep partial match)
        if (exp.bodyIncludes) {
          expectPartialMatch(result.body, exp.bodyIncludes, 'body');
        }

        // Body excludes
        if (exp.bodyExcludes) {
          for (const key of exp.bodyExcludes) {
            expect(result.body).not.toHaveProperty(key);
          }
        }

        // Prompt includes
        if (exp.promptIncludes) {
          const prompt = findPrompt(result.body);
          expect(prompt, 'prompt not found in body').toBeTruthy();
          expect(prompt).toContain(exp.promptIncludes);
        }

        // Prompt excludes
        if (exp.promptExcludes) {
          const prompt = findPrompt(result.body);
          if (prompt) {
            expect(prompt).not.toContain(exp.promptExcludes);
          }
        }
      });
    }
  });
}
