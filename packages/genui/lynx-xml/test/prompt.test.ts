// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from '@rstest/core';

import {
  LYNX_XML_ENGINE_VERSION,
  LYNX_XML_SYSTEM_PROMPT,
  buildLynxXmlSystemPrompt,
} from '../src/index.js';
import { LYNX_XML_MOBILE_DESIGN_GUIDANCE } from '../src/mobile-design.js';

describe('buildLynxXmlSystemPrompt', () => {
  test('builds the exported default prompt', () => {
    expect(LYNX_XML_ENGINE_VERSION).toBe('4.2');
    expect(LYNX_XML_SYSTEM_PROMPT).toBe(buildLynxXmlSystemPrompt());
  });

  test('composes guidance from the Vanilla Lynx skill dependency', () => {
    expect(LYNX_XML_SYSTEM_PROMPT).toContain(
      'bundled from @lynx-js/skill-vanilla-lynx',
    );
    expect(LYNX_XML_SYSTEM_PROMPT).toContain('### SKILL.md');
    expect(LYNX_XML_SYSTEM_PROMPT).toContain(
      '### references/main-thread.md',
    );
    expect(LYNX_XML_SYSTEM_PROMPT).toContain('### references/event.md');
    expect(LYNX_XML_SYSTEM_PROMPT).toContain(
      '### references/background.md',
    );
    expect(LYNX_XML_SYSTEM_PROMPT).toContain('### references/style.md');
    expect(LYNX_XML_SYSTEM_PROMPT).toContain(
      'All four `__AddEventListener(element, eventName, handler, options)` arguments are mandatory',
    );
    expect(LYNX_XML_SYSTEM_PROMPT).toContain(
      '`__SetDataset` and `__AddDataset`',
    );
    expect(LYNX_XML_SYSTEM_PROMPT).toContain('`__ElementIsEqual`');
    expect(LYNX_XML_SYSTEM_PROMPT).toContain(
      'Main-thread local event loop',
    );
    expect(LYNX_XML_SYSTEM_PROMPT).toContain(
      'Do not echo first-screen data back to main thread',
    );
    expect(LYNX_XML_SYSTEM_PROMPT).toContain(
      'The default `box-sizing` is `auto`',
    );
    expect(LYNX_XML_SYSTEM_PROMPT).not.toContain('```');
    expect(LYNX_XML_SYSTEM_PROMPT).not.toContain(
      'Keep external bundle building and loading separate',
    );
    expect(LYNX_XML_SYSTEM_PROMPT).not.toContain(
      'globalThis.processData',
    );
  });

  test('adds the Lynx XML artifact and runtime adaptation contracts', () => {
    expect(LYNX_XML_SYSTEM_PROMPT).toContain('Return only the raw artifact');
    expect(LYNX_XML_SYSTEM_PROMPT).toContain('<!doctype lynx>');
    expect(LYNX_XML_SYSTEM_PROMPT).toContain('corresponding PageConfig key');
    expect(LYNX_XML_SYSTEM_PROMPT).toContain('Never invent root');
    expect(LYNX_XML_SYSTEM_PROMPT).toContain('__CreatePage("0", 0)');
    expect(LYNX_XML_SYSTEM_PROMPT).toContain('__AppendElement');
    expect(LYNX_XML_SYSTEM_PROMPT).toContain('__SetID');
    expect(LYNX_XML_SYSTEM_PROMPT).toContain('__SetAttribute');
    expect(LYNX_XML_SYSTEM_PROMPT).toContain('__ElementIsEqual');
    expect(LYNX_XML_SYSTEM_PROMPT).toContain('__RenderPage');
    expect(LYNX_XML_SYSTEM_PROMPT).toContain('__UpdatePage');
    expect(LYNX_XML_SYSTEM_PROMPT).toContain('__DestroyLifetime');
    expect(LYNX_XML_SYSTEM_PROMPT).toContain('__FlushElementTree()');
    expect(LYNX_XML_SYSTEM_PROMPT).toContain(
      '__AddEventListener(element, eventName, handler, options)',
    );
    expect(LYNX_XML_SYSTEM_PROMPT).toContain('lynx.getJSContext()');
    expect(LYNX_XML_SYSTEM_PROMPT).toContain('lynx.getCoreContext()');
  });

  test('keeps node references separate from ids when appending elements', () => {
    expect(LYNX_XML_SYSTEM_PROMPT).toContain(
      '__AppendElement(parentNode, childNode)',
    );
    expect(LYNX_XML_SYSTEM_PROMPT).toContain(
      'both arguments must be node references',
    );
    expect(LYNX_XML_SYSTEM_PROMPT).toMatch(
      /never pass pageId,\s+__GetElementUniqueID\(\.\.\.\), or any other number/u,
    );
    expect(LYNX_XML_SYSTEM_PROMPT).toContain(
      'pass the parent node reference into the helper, not its id',
    );
    expect(LYNX_XML_SYSTEM_PROMPT).toMatch(
      /Use pageId\s+only as the parent component id/u,
    );
  });

  test('overrides the imported layout guidance for Lynx XML', () => {
    expect(LYNX_XML_SYSTEM_PROMPT).toContain('white-space: normal');
    expect(LYNX_XML_SYSTEM_PROMPT).toContain(
      'CSS `@media` rules do not take effect at runtime',
    );
    expect(LYNX_XML_SYSTEM_PROMPT).toMatch(
      /Use calc\(\) only\s+for length-valued properties/u,
    );
    expect(LYNX_XML_SYSTEM_PROMPT).toContain('flex-shrink: 0');
    expect(LYNX_XML_SYSTEM_PROMPT).toContain(
      'every node that lays out Element children must explicitly',
    );
    expect(LYNX_XML_SYSTEM_PROMPT).toContain('set display: flex');
    expect(LYNX_XML_SYSTEM_PROMPT).toContain(
      'Explicitly set flex-direction: column or flex-direction: row',
    );
    expect(LYNX_XML_SYSTEM_PROMPT).not.toContain(
      'Prefer it for simple columns',
    );
    expect(LYNX_XML_SYSTEM_PROMPT).toContain(
      'Function, fetchBundle, loadScript',
    );
  });

  test('adds the concrete long-page scroll-view contract to the XML adaptation', () => {
    expect(LYNX_XML_SYSTEM_PROMPT).toContain(
      'The page root is not a scroll container',
    );
    expect(LYNX_XML_SYSTEM_PROMPT).toContain(
      'the first business node appended directly to the page must be created',
    );
    expect(LYNX_XML_SYSTEM_PROMPT).toContain('__CreateScrollView(pageId)');
    expect(LYNX_XML_SYSTEM_PROMPT).toMatch(
      /do not\s+wrap it in a business __CreateView/u,
    );
    expect(LYNX_XML_SYSTEM_PROMPT).toContain(
      'scroll-orientation attribute to "vertical" with',
    );
    expect(LYNX_XML_SYSTEM_PROMPT).toContain(
      'Do not nest vertical scroll views',
    );
  });

  test('adds provider-neutral mobile-first design constraints', () => {
    expect(LYNX_XML_SYSTEM_PROMPT).toContain('Mobile design contract:');
    expect(LYNX_XML_SYSTEM_PROMPT).toContain('from 320px to 430px');
    expect(LYNX_XML_SYSTEM_PROMPT).toContain(
      'Do not default to a centered desktop canvas',
    );
    expect(LYNX_XML_SYSTEM_PROMPT).toContain(
      'one outer page-level vertical scrolling surface',
    );
    expect(LYNX_XML_SYSTEM_PROMPT).toContain(
      'env(safe-area-inset-top)',
    );
    expect(LYNX_XML_SYSTEM_PROMPT).toContain('exactly once per exposed edge');
    expect(LYNX_XML_SYSTEM_PROMPT).toContain(
      'font-size: calc(100vw / 23.4375)',
    );
    expect(LYNX_XML_SYSTEM_PROMPT).toContain('semantic token set');
    expect(LYNX_XML_SYSTEM_PROMPT).toContain('at least 44px by 44px');
    expect(LYNX_XML_SYSTEM_PROMPT).toMatch(
      /Never make\s+hover the only indication of interactivity/u,
    );
    expect(LYNX_XML_SYSTEM_PROMPT).toContain(
      'scrolling content must reserve',
    );
    expect(LYNX_XML_SYSTEM_PROMPT).toContain(
      'avoid card-inside-card layouts',
    );
    expect(LYNX_XML_MOBILE_DESIGN_GUIDANCE).not.toContain(
      '__CreateScrollView',
    );
    expect(LYNX_XML_MOBILE_DESIGN_GUIDANCE).not.toContain(
      'scroll-orientation',
    );
  });

  test('supports a validated engine version and caller appendix', () => {
    const prompt = buildLynxXmlSystemPrompt({
      engineVersion: ' 5.1 ',
      appendix: '  Prefer a compact information hierarchy.  ',
    });

    expect(prompt).toContain('<lynx engine-version="5.1">');
    expect(prompt).not.toContain('<lynx engine-version="4.2">');
    expect(prompt.endsWith('Prefer a compact information hierarchy.')).toBe(
      true,
    );
  });

  test.each(['', 'latest', '4.x', '4.2" other="value'])(
    'rejects invalid engine version %j',
    engineVersion => {
      expect(() => buildLynxXmlSystemPrompt({ engineVersion })).toThrow(
        'Invalid Lynx engine version',
      );
    },
  );

  test('ignores an empty appendix', () => {
    expect(buildLynxXmlSystemPrompt({ appendix: '  ' })).toBe(
      LYNX_XML_SYSTEM_PROMPT,
    );
  });
});
