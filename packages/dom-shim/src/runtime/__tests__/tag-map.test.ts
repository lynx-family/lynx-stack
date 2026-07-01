// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  TAG_MAP,
  TAG_MAP_VERSION,
  htmlToLynx,
  lynxToHtml,
} from '../tag-map.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SPEC_PATH = resolve(
  __dirname,
  '../../../SPEC/TAG_MAP.json',
);

interface SpecFile {
  version: string;
  description: string;
  entries: Record<string, Record<string, unknown>>;
}

const specJson = JSON.parse(readFileSync(SPEC_PATH, 'utf8')) as SpecFile;

describe('US-441 HTML→Lynx tag map', () => {
  it('SPEC/TAG_MAP.json version matches runtime constant', () => {
    expect(TAG_MAP_VERSION).toBe(specJson.version);
  });

  it('every SPEC entry exists in runtime TAG_MAP', () => {
    for (const tag of Object.keys(specJson.entries)) {
      expect(TAG_MAP).toHaveProperty(tag);
    }
  });

  it('every runtime TAG_MAP entry exists in SPEC', () => {
    for (const tag of Object.keys(TAG_MAP)) {
      expect(specJson.entries).toHaveProperty(tag);
    }
  });

  it('SPEC and runtime entries have matching fields', () => {
    for (const [tag, specEntry] of Object.entries(specJson.entries)) {
      const runtimeEntry = TAG_MAP[tag] as Record<string, unknown>;
      expect(runtimeEntry).toBeDefined();
      for (const key of Object.keys(specEntry)) {
        expect(runtimeEntry[key]).toEqual(specEntry[key]);
      }
    }
  });

  describe('htmlToLynx', () => {
    it('returns mapped result for known tags', () => {
      const outcome = htmlToLynx('div');
      expect(outcome.kind).toBe('mapped');
      if (outcome.kind === 'mapped') {
        expect(outcome.result.factory).toBe('view');
      }
    });

    it('honors defaultClasses', () => {
      const outcome = htmlToLynx('h1');
      expect(outcome.kind).toBe('mapped');
      if (outcome.kind === 'mapped') {
        expect(outcome.result.factory).toBe('text');
        expect(outcome.result.defaultClasses).toEqual(['shim-h1']);
      }
    });

    it('returns skipped for <script>', () => {
      const outcome = htmlToLynx('script');
      expect(outcome.kind).toBe('skipped');
      if (outcome.kind === 'skipped') {
        expect(outcome.divergence).toBe('shim:L3b/script-skipped');
      }
    });

    it('returns fallback for unmapped tags', () => {
      const outcome = htmlToLynx('totally-custom-tag');
      expect(outcome.kind).toBe('fallback');
      if (outcome.kind === 'fallback') {
        expect(outcome.rawTag).toBe('totally-custom-tag');
      }
    });

    it('is case-insensitive', () => {
      const outcome = htmlToLynx('DIV');
      expect(outcome.kind).toBe('mapped');
    });

    it('input maps to factory=\'element\' with rawTag=\'input\'', () => {
      const outcome = htmlToLynx('input');
      expect(outcome.kind).toBe('mapped');
      if (outcome.kind === 'mapped') {
        expect(outcome.result.factory).toBe('element');
        expect(outcome.result.rawTag).toBe('input');
      }
    });
  });

  describe('lynxToHtml', () => {
    it('view → div', () => {
      expect(lynxToHtml('view')).toBe('div');
    });

    it('text → span', () => {
      expect(lynxToHtml('text')).toBe('span');
    });

    it('image → img', () => {
      expect(lynxToHtml('image')).toBe('img');
    });

    it('scroll-view → div', () => {
      expect(lynxToHtml('scroll-view')).toBe('div');
    });

    it('input → input', () => {
      expect(lynxToHtml('input')).toBe('input');
    });

    it('unknown Lynx tag → itself', () => {
      expect(lynxToHtml('custom-future-thing')).toBe('custom-future-thing');
    });
  });
});
