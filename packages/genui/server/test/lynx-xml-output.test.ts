// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from '@rstest/core';

import {
  extractLynxXmlArtifact,
  normalizeLynxXmlArtifact,
} from '../agent/lynx-xml-output.js';

const VALID_ARTIFACT = [
  '<!doctype lynx>',
  '<lynx engine-version="4.2">',
  '<style>.root { display: flex; }</style>',
  '<script thread="main">globalThis.processData = () => {};</script>',
  '</lynx>',
].join('\n');

describe('Lynx XML model output', () => {
  test('extracts a canonical artifact from a fenced response', () => {
    const response = `Here you go:\n\`\`\`xml\n${VALID_ARTIFACT}\n\`\`\``;
    expect(extractLynxXmlArtifact(response)).toBe(VALID_ARTIFACT);
    expect(normalizeLynxXmlArtifact(response)).toBe(VALID_ARTIFACT);
  });

  test('keeps an in-progress artifact available to streaming clients', () => {
    expect(extractLynxXmlArtifact(
      '<!doctype lynx>\n<lynx engine-version="4.2">',
    )).toBe('<!doctype lynx>\n<lynx engine-version="4.2">');
  });

  test('rejects incomplete and non-canonical final artifacts', () => {
    expect(() => normalizeLynxXmlArtifact('No source')).toThrow(
      'returned no <!doctype lynx> artifact',
    );
    expect(() =>
      normalizeLynxXmlArtifact(
        '<!doctype lynx><lynx engine-version="4.2"></lynx>',
      )
    ).toThrow('exactly one main-thread script');
    expect(() =>
      normalizeLynxXmlArtifact(
        '<!doctype lynx><lynx engine-version="4.2">'
          + '<script thread="main"><![CDATA[bad]]></script></lynx>',
      )
    ).toThrow('must not use CDATA');
  });
});
