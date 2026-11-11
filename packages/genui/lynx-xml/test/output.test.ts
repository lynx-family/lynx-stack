// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from '@rstest/core';

import {
  assembleLynxXmlArtifact,
  normalizeLynxXmlArtifact,
} from '../src/index.js';
import { extractLynxXmlArtifact } from '../src/output.js';

const VALID_ARTIFACT = [
  '<!doctype lynx>',
  '<lynx engine-version="4.2">',
  '<style>.root { display: flex; }</style>',
  '<script thread="main">globalThis.processData = () => {};</script>',
  '</lynx>',
].join('\n');

describe('Lynx XML model output', () => {
  test('exposes normalization while keeping extraction internal', async () => {
    expect(await import('../src/index.js')).not.toHaveProperty(
      'extractLynxXmlArtifact',
    );
  });

  test.each([
    {},
    { enableHtmlFragment: true },
    { enableScriptReuse: true },
    { enableHtmlFragment: true, enableScriptReuse: true },
  ])(
    'assembles model responses without caller-side extraction: %j',
    options => {
      let script = '';
      if (options.enableScriptReuse) script = 'definePage({ render(ctx) {} });';
      else if (options.enableHtmlFragment) {
        script = 'createFragment(page, pageId);';
      }
      const source = VALID_ARTIFACT
        .replace('globalThis.processData = () => {};', script)
        .replace(
          '<style>',
          (options.enableHtmlFragment ? '<template><view/></template>' : '')
            + '<style>',
        );
      const expected = assembleLynxXmlArtifact(source, options);
      const response = `Here you go:\n\`\`\`xml\n${source}\n\`\`\``;
      expect(assembleLynxXmlArtifact(response, options)).toEqual(expected);
      expect(assembleLynxXmlArtifact(
        response.replace('<!doctype lynx>\n', ''),
        options,
      )).toEqual(expected);
      expect(normalizeLynxXmlArtifact(expected.text)).toBe(expected.text);
    },
  );

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

  test('repairs a missing doctype when the Lynx root is present', () => {
    const withoutDoctype = VALID_ARTIFACT.replace(/^<!doctype lynx>\n/u, '');
    expect(normalizeLynxXmlArtifact(withoutDoctype)).toBe(VALID_ARTIFACT);
  });

  test('returns no source when extraction cannot find a document', () => {
    expect(extractLynxXmlArtifact('No source')).toBe('');
  });

  test.each([
    [
      VALID_ARTIFACT.replace('</lynx>', ''),
      'missing the closing </lynx> tag',
    ],
    [
      VALID_ARTIFACT.replace(' engine-version="4.2"', ''),
      'must use <lynx engine-version="..."> as its root',
    ],
    [
      VALID_ARTIFACT.replace(
        '</lynx>',
        '<script thread="main"></script></lynx>',
      ),
      'exactly one main-thread script',
    ],
    [
      VALID_ARTIFACT.replace('</script>', ''),
      'main-thread script is not closed',
    ],
  ])('rejects a broken document contract: %s', (source, error) => {
    expect(() => normalizeLynxXmlArtifact(source)).toThrow(error);
  });

  test('leaves JavaScript and CSS parsing to the consumer', () => {
    const source = VALID_ARTIFACT
      .replace('globalThis.processData = () => {};', 'const broken = ;')
      .replace('.root { display: flex; }', '.root {');
    expect(normalizeLynxXmlArtifact(source)).toBe(source);
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
