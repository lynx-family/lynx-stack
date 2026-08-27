// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from '@rstest/core';

import {
  extractHtmlArtifact,
  normalizeHtmlArtifact,
} from '../agent/html-output.js';

const VALID_ARTIFACT = [
  '<!doctype html>',
  '<html lang="en">',
  '<head><meta charset="utf-8"><title>Counter</title></head>',
  '<body><button type="button">Count</button></body>',
  '</html>',
].join('\n');

describe('HTML model output', () => {
  test('extracts a complete document from a fenced response', () => {
    const response = `Here you go:\n\`\`\`html\n${VALID_ARTIFACT}\n\`\`\``;
    expect(extractHtmlArtifact(response)).toBe(VALID_ARTIFACT);
    expect(normalizeHtmlArtifact(response)).toBe(VALID_ARTIFACT);
  });

  test('keeps an in-progress document available to streaming clients', () => {
    expect(extractHtmlArtifact('<!doctype html>\n<html><head>')).toBe(
      '<!doctype html>\n<html><head>',
    );
  });

  test('accepts the case-insensitive HTML document syntax', () => {
    const source = VALID_ARTIFACT
      .replace('<!doctype html>', '<!DOCTYPE HTML>')
      .replace('<html lang="en">', '<HTML lang="en">')
      .replace('</html>', '</HTML>');
    expect(normalizeHtmlArtifact(source)).toBe(source);
  });

  test('rejects incomplete document envelopes', () => {
    expect(() => normalizeHtmlArtifact('No source')).toThrow(
      'returned no <!doctype html> document',
    );
    expect(() =>
      normalizeHtmlArtifact('<!doctype html><html><head></head><body>')
    ).toThrow('closing </html> tag');
    expect(() => normalizeHtmlArtifact('<!doctype html><main></main></html>'))
      .toThrow('must use <html> as its root');
    expect(() =>
      normalizeHtmlArtifact(
        '<!doctype html><html><body></body></html>',
      )
    ).toThrow('missing a <head> element');
  });
});
