// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from '@rstest/core';
import { readFileSync } from 'node:fs';
import { parseLynxMarkup } from '../ts/client/decodeWorker/parseLynxMarkup.js';

describe('parseLynxMarkup', () => {
  test('parses Lynx style and thread sections', () => {
    expect(parseLynxMarkup(`
      <!DOCTYPE lynx>
      <style>
        .root { background-color: pink; }
      </style>
      <script main-thread>
        globalThis.renderPage = () => {};
      </script>
      <script background>
        globalThis.__lynx_worker_type = 'background';
      </script>
    `)).toEqual({
      style: '\n        .root { background-color: pink; }\n      ',
      mainThread: '\n        globalThis.renderPage = () => {};\n      ',
      background:
        '\n        globalThis.__lynx_worker_type = \'background\';\n      ',
    });
  });

  test('allows comments and sections in any order', () => {
    expect(parseLynxMarkup(`
      \uFEFF<!doctype lynx>
      <!-- generated directly by an LLM -->
      <script background>backgroundCode()</script>
      <style></style>
      <script main-thread>mainThreadCode()</script>
    `)).toEqual({
      background: 'backgroundCode()',
      style: '',
      mainThread: 'mainThreadCode()',
    });
  });

  test('parses the Hangzhou travel-card example', () => {
    const example = readFileSync(
      new URL(
        '../../../../examples/lynx-markup-hangzhou/public/hangzhou-trip.xml',
        import.meta.url,
      ),
      'utf8',
    );

    const markup = parseLynxMarkup(example);
    expect(markup.style).toContain('.day-card-selected');
    expect(markup.mainThread).toContain(
      'globalThis.renderPage = function renderPage()',
    );
    expect(markup.background).toContain('type: \'trip-day-selected\'');
    expect(() => new Function(markup.mainThread)).not.toThrow();
    expect(() => new Function(markup.background)).not.toThrow();
  });

  test.each([
    ['missing doctype', '<style></style>', 'expected <!doctype lynx>'],
    [
      'unknown script attribute',
      '<!doctype lynx><script worker></script>',
      'requires exactly one main-thread or background attribute',
    ],
    [
      'duplicate section',
      '<!doctype lynx><style></style><style></style>',
      'duplicate <style> section',
    ],
    [
      'unclosed section',
      '<!doctype lynx><script main-thread>',
      'missing closing </script> tag',
    ],
  ])('rejects %s', (_, source, message) => {
    expect(() => parseLynxMarkup(source)).toThrow(message);
  });
});
