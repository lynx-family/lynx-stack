// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import { describe, expect, test } from '@rstest/core';

import { buildLynxXmlSystemPrompt } from '../src/prompt.js';

const require = createRequire(import.meta.url);
const resolvePackage = Reflect.get(require, 'resolve') as (
  packageId: string,
) => string;
const LYNX_XML_PACKAGE_ROOT = path.dirname(
  resolvePackage('@lynx-js/genui-lynx-xml/package.json'),
);
const packagedHangzhouTripExample = fs.readFileSync(
  path.join(LYNX_XML_PACKAGE_ROOT, 'examples/hangzhou-trip.xml'),
  'utf8',
).trim();
const sourceHangzhouTripExample = fs.readFileSync(
  path.join(
    LYNX_XML_PACKAGE_ROOT,
    '../../../examples/lynx-markup-hangzhou/public/hangzhou-trip.xml',
  ),
  'utf8',
).trim();

describe('Lynx XML prompt', () => {
  test('loads vanilla Lynx and applies explicit CSS and XML rules', () => {
    const prompt = buildLynxXmlSystemPrompt({ appendix: 'Use a blue theme.' });

    expect(prompt).toContain('@lynx-js/skill-vanilla-lynx');
    expect(prompt).toContain('# Build Vanilla Lynx Apps');
    expect(prompt).toContain('# Main Thread Rendering Reference');
    expect(prompt).toContain('# Runtime Communication API Reference');
    expect(prompt).toContain('# Background Thread Reference');
    expect(prompt).not.toContain('@lynx-js/skill-lynx-check-css-support');
    expect(prompt).not.toContain('checkLynxCssSupport');
    expect(prompt).toContain(
      'skills/using-lynx-api-docs/lynx-vs-web/unsupported-features.md',
    );
    expect(prompt).toContain(
      'skills/using-lynx-api-docs/lynx-vs-web/css-differences.md',
    );
    expect(prompt).toContain(
      'Never use structural pseudo-classes such as :nth-child()',
    );
    expect(prompt).toContain('Never use @media');
    expect(prompt).toContain('Never use calc() for colors');
    expect(prompt).toContain('env(safe-area-inset-top)');
    expect(prompt).toContain(
      'Give the relevant scroll parent position:relative and z-index:0',
    );
    expect(prompt).toContain('<script main-thread>');
    expect(prompt).toContain('globalThis.renderPage');
    expect(prompt).toContain('lynx.getCoreContext()');
    expect(prompt).toContain('Never write JSX tags');
    expect(prompt).toContain('The main-thread script is rejected');
    expect(prompt).toContain('rewrite every component function');
    expect(prompt).toContain('Prefer a smaller complete UI');
    expect(prompt).toContain(
      'Create every scrollable container with __CreateScrollView(pageId)',
    );
    expect(prompt).toContain(
      '<lynx-xml-worked-example>\n<!DOCTYPE lynx>',
    );
    expect(prompt).toContain(packagedHangzhouTripExample);
    expect(prompt).toContain('Use a blue theme.');
  });

  test('requires a root scroll view for content longer than one viewport', () => {
    const prompt = buildLynxXmlSystemPrompt();

    expect(prompt).toContain(
      'the outermost content container appended directly to page must be a vertical __CreateScrollView(pageId)',
    );
    expect(prompt).toContain(
      'do not place an outer __CreateView between page and the root scroll view',
    );
  });

  test('keeps the packaged worked example in sync with its source', () => {
    expect(packagedHangzhouTripExample).toBe(sourceHangzhouTripExample);
  });
});
