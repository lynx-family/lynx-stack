// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from '@rstest/core';

import {
  extractLynxXmlArtifact,
  normalizeLynxXmlArtifact,
} from '../src/index.js';

const VALID_ARTIFACT = `<!doctype lynx>
<lynx engine-version="4.2">
<script thread="main">
const page = __CreatePage("0", 0);
</script>
</lynx>`;

describe('Lynx XML output normalization', () => {
  test('extracts the final artifact from decorated model output', () => {
    expect(extractLynxXmlArtifact(`Before\n${VALID_ARTIFACT}\nAfter`)).toBe(
      VALID_ARTIFACT,
    );
    expect(normalizeLynxXmlArtifact(`Before\n${VALID_ARTIFACT}\nAfter`)).toBe(
      VALID_ARTIFACT,
    );
  });

  test('rejects missing roots, scripts, closing tags, and CDATA', () => {
    expect(() => normalizeLynxXmlArtifact('not xml')).toThrow(/no <!doctype/u);
    expect(() =>
      normalizeLynxXmlArtifact(VALID_ARTIFACT.replace('</lynx>', ''))
    ).toThrow(/closing <\/lynx>/u);
    expect(() =>
      normalizeLynxXmlArtifact(
        VALID_ARTIFACT.replace('<script thread="main">', ''),
      )
    ).toThrow(/exactly one main-thread/u);
    expect(() =>
      normalizeLynxXmlArtifact(VALID_ARTIFACT.replace(
        'const page',
        '<![CDATA[ const page',
      ))
    ).toThrow(/CDATA/u);
  });
});
