// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from '@rstest/core';

import {
  LYNX_XML_ENGINE_VERSION,
  LYNX_XML_HTML_FRAGMENT_TOOL_INSTRUCTIONS,
  LYNX_XML_HTML_FRAGMENT_TOOL_SYSTEM_PROMPT,
  LYNX_XML_SYSTEM_PROMPT,
  buildLynxXmlSystemPrompt,
} from '../src/index.js';
import { LYNX_XML_MOBILE_DESIGN_GUIDANCE } from '../src/mobile-design.js';

describe('buildLynxXmlSystemPrompt', () => {
  test('builds the exported default prompt', () => {
    expect(LYNX_XML_ENGINE_VERSION).toBe('4.2');
    expect(LYNX_XML_SYSTEM_PROMPT).toBe(buildLynxXmlSystemPrompt());
  });

  test('builds the prompt for agents with the fragment conversion tool', () => {
    expect(LYNX_XML_HTML_FRAGMENT_TOOL_SYSTEM_PROMPT).toBe(
      buildLynxXmlSystemPrompt({
        appendix: LYNX_XML_HTML_FRAGMENT_TOOL_INSTRUCTIONS,
      }),
    );
    expect(LYNX_XML_SYSTEM_PROMPT).not.toContain(
      'html_fragment_to_main_thread_script',
    );
    expect(LYNX_XML_HTML_FRAGMENT_TOOL_SYSTEM_PROMPT).toContain(
      'html_fragment_to_main_thread_script',
    );
    expect(LYNX_XML_HTML_FRAGMENT_TOOL_SYSTEM_PROMPT).toContain(
      'opaque placeholder comment',
    );
    expect(LYNX_XML_HTML_FRAGMENT_TOOL_SYSTEM_PROMPT).toContain(
      'bindings map',
    );
    expect(LYNX_XML_HTML_FRAGMENT_TOOL_SYSTEM_PROMPT).toContain(
      'It does not return the generated JavaScript',
    );
  });

  test('composes guidance from the Vanilla Lynx skill dependency', () => {
    expect(LYNX_XML_SYSTEM_PROMPT).toContain(
      'bundled from @lynx-js/skill-vanilla-lynx',
    );
    expect(LYNX_XML_SYSTEM_PROMPT).toContain('### SKILL.md');
    expect(LYNX_XML_SYSTEM_PROMPT).toContain('### references/lynxml.md');
    expect(LYNX_XML_SYSTEM_PROMPT).toContain(
      '### references/main-thread.md',
    );
    expect(LYNX_XML_SYSTEM_PROMPT).toContain('### references/event.md');
    expect(LYNX_XML_SYSTEM_PROMPT).toContain(
      '### references/background.md',
    );
    expect(LYNX_XML_SYSTEM_PROMPT).toContain('### references/style.md');
    expect(LYNX_XML_SYSTEM_PROMPT).toContain(
      '`options` is required even though its `capture`',
    );
    expect(LYNX_XML_SYSTEM_PROMPT).toContain('`__SetDataset');
    expect(LYNX_XML_SYSTEM_PROMPT).toContain('`__AddDataset');
    expect(LYNX_XML_SYSTEM_PROMPT).toContain('`__ElementIsEqual`');
    expect(LYNX_XML_SYSTEM_PROMPT).toContain(
      'Main-thread local event loop',
    );
    expect(LYNX_XML_SYSTEM_PROMPT).toContain(
      'Do not echo first-screen data back to main thread',
    );
    expect(LYNX_XML_SYSTEM_PROMPT).toContain(
      'Treat the default box model as `border-box`',
    );
    expect(LYNX_XML_SYSTEM_PROMPT).toContain(
      'Treat `ElementRef` as an opaque main-thread handle',
    );
    expect(LYNX_XML_SYSTEM_PROMPT).toContain(
      'keep `__DestroyLifetime` reserved for the Engine lifecycle',
    );
    expect(LYNX_XML_SYSTEM_PROMPT).toContain(
      'Keep JavaScript and CSS source text raw',
    );
    expect(LYNX_XML_SYSTEM_PROMPT).toContain(
      'Deliver the complete `.lynxml` document',
    );
    expect(LYNX_XML_SYSTEM_PROMPT).toContain(
      'must already have a non-zero layout box',
    );
    expect(LYNX_XML_SYSTEM_PROMPT).toContain(
      'set a viewport-based root font size with `vw`',
    );
    expect(LYNX_XML_SYSTEM_PROMPT).toContain(
      'Set explicit `width` and `height` on every image',
    );
    expect(LYNX_XML_SYSTEM_PROMPT).not.toContain('```');
    expect(LYNX_XML_SYSTEM_PROMPT).not.toContain(
      'Keep external bundle building and loading separate',
    );
    expect(LYNX_XML_SYSTEM_PROMPT).not.toContain('external-build.md');
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
      '__AddEventListener(node: ElementRef, eventName: string',
    );
    expect(LYNX_XML_SYSTEM_PROMPT).toContain('lynx.getJSContext()');
    expect(LYNX_XML_SYSTEM_PROMPT).toContain('lynx.getCoreContext()');
  });

  test('keeps node references separate from ids when appending elements', () => {
    expect(LYNX_XML_SYSTEM_PROMPT).toContain(
      'every __AppendElement argument',
    );
    expect(LYNX_XML_SYSTEM_PROMPT).toMatch(
      /append helper's parent must be a node/u,
    );
    expect(LYNX_XML_SYSTEM_PROMPT).toMatch(
      /never append\s+pageId,\s+__GetElementUniqueID\(\.\.\.\), or another number/u,
    );
    expect(LYNX_XML_SYSTEM_PROMPT).toMatch(
      /Use pageId\s+only as the first argument\s+to page-owned element creation APIs/u,
    );
  });

  test('overrides the imported layout guidance for Lynx XML', () => {
    expect(LYNX_XML_SYSTEM_PROMPT).toContain('white-space: normal');
    expect(LYNX_XML_SYSTEM_PROMPT).toContain(
      'Do not use `@media`, `@supports`, `@layer`, `@keyframes`',
    );
    expect(LYNX_XML_SYSTEM_PROMPT).toMatch(
      /Use calc\(\) only\s+for length-valued properties/u,
    );
    expect(LYNX_XML_SYSTEM_PROMPT).toContain('flex-shrink: 0');
    expect(LYNX_XML_SYSTEM_PROMPT).toContain(
      'every container that lays out Element children',
    );
    expect(LYNX_XML_SYSTEM_PROMPT).toContain(
      'Apply a class with display: flex',
    );
    expect(LYNX_XML_SYSTEM_PROMPT).toContain(
      'an explicit row or column flex-direction',
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
      'Append the first business node directly to it',
    );
    expect(LYNX_XML_SYSTEM_PROMPT).toMatch(
      /append\s+__CreateScrollView\(pageId\) directly to/u,
    );
    expect(LYNX_XML_SYSTEM_PROMPT).toContain('__CreateScrollView(pageId)');
    expect(LYNX_XML_SYSTEM_PROMPT).toContain(
      'never below a business view',
    );
    expect(LYNX_XML_SYSTEM_PROMPT).toContain(
      'scroll-orientation to "vertical" with',
    );
    expect(LYNX_XML_SYSTEM_PROMPT).toMatch(
      /Do not nest\s+vertical scroll\s+views/u,
    );
  });

  test('adds provider-neutral mobile-first design constraints', () => {
    expect(LYNX_XML_SYSTEM_PROMPT).toContain('Mobile design contract:');
    expect(LYNX_XML_SYSTEM_PROMPT).toContain('Viewport and structure:');
    expect(LYNX_XML_SYSTEM_PROMPT).toContain(
      'Responsive scale and spacing:',
    );
    expect(LYNX_XML_SYSTEM_PROMPT).toContain(
      'Visual hierarchy, typography, and color:',
    );
    expect(LYNX_XML_SYSTEM_PROMPT).toContain(
      'Interaction, forms, and state:',
    );
    expect(LYNX_XML_SYSTEM_PROMPT).toContain('Media and motion:');
    expect(LYNX_XML_SYSTEM_PROMPT).toContain('Override boundary:');
    expect(LYNX_XML_SYSTEM_PROMPT).toContain('from 320px to 430px');
    expect(LYNX_XML_SYSTEM_PROMPT).toContain(
      'Do not default to a centered desktop canvas',
    );
    expect(LYNX_XML_SYSTEM_PROMPT).toContain(
      'one outer page-level vertical scrolling surface',
    );
    expect(LYNX_XML_SYSTEM_PROMPT).toMatch(
      /host or\s+initialization data explicitly supplies them/u,
    );
    expect(LYNX_XML_SYSTEM_PROMPT).toContain('exactly once per exposed edge');
    expect(LYNX_XML_SYSTEM_PROMPT).toMatch(
      /Never\s+derive safe-area insets from Web CSS environment variables/u,
    );
    expect(LYNX_XML_SYSTEM_PROMPT).toContain(
      'font-size: calc(100vw / 23.4375)',
    );
    expect(LYNX_XML_SYSTEM_PROMPT).toContain('small semantic palette');
    expect(LYNX_XML_SYSTEM_PROMPT).toContain('at least 44px by 44px');
    expect(LYNX_XML_SYSTEM_PROMPT).toContain(
      'Do not depend on hover feedback',
    );
    expect(LYNX_XML_SYSTEM_PROMPT).toMatch(
      /scrolling content must\s+reserve/u,
    );
    expect(LYNX_XML_SYSTEM_PROMPT).toContain(
      'avoid card-inside-card layouts',
    );
    expect(LYNX_XML_SYSTEM_PROMPT).toContain(
      'Never rely on color alone',
    );
    expect(LYNX_XML_SYSTEM_PROMPT).toContain('placeholder text');
    expect(LYNX_XML_SYSTEM_PROMPT).toContain(
      'must not be the only label',
    );
    expect(LYNX_XML_SYSTEM_PROMPT).toContain(
      'loading, empty, error, offline, success, disabled, and selected states',
    );
    expect(LYNX_XML_SYSTEM_PROMPT).toMatch(
      /Meaning and state must remain clear\s+in\s+a\s+static presentation/u,
    );
    expect(LYNX_XML_MOBILE_DESIGN_GUIDANCE).not.toContain(
      '__CreateScrollView',
    );
    expect(LYNX_XML_MOBILE_DESIGN_GUIDANCE).not.toContain(
      'scroll-orientation',
    );
    expect(LYNX_XML_MOBILE_DESIGN_GUIDANCE).not.toContain('CSS variables');
    expect(LYNX_XML_MOBILE_DESIGN_GUIDANCE).not.toContain('aria-label');
    expect(LYNX_XML_MOBILE_DESIGN_GUIDANCE).not.toContain('aspectFit');
    expect(LYNX_XML_MOBILE_DESIGN_GUIDANCE).not.toContain('aspectFill');
    expect(LYNX_XML_MOBILE_DESIGN_GUIDANCE).not.toContain('@media');
    expect(LYNX_XML_MOBILE_DESIGN_GUIDANCE).not.toContain('container query');
    expect(LYNX_XML_MOBILE_DESIGN_GUIDANCE).not.toContain('clamp(');
    expect(LYNX_XML_MOBILE_DESIGN_GUIDANCE).not.toContain('srcset');
    expect(LYNX_XML_MOBILE_DESIGN_GUIDANCE).not.toContain(
      'Core Web Vitals',
    );
    expect(LYNX_XML_MOBILE_DESIGN_GUIDANCE).not.toContain('semantic HTML');
    expect(LYNX_XML_MOBILE_DESIGN_GUIDANCE).not.toContain(
      'prefers-reduced-motion',
    );
    expect(LYNX_XML_SYSTEM_PROMPT).not.toContain('env(');
  });

  test('maps provider-neutral accessibility intent to Lynx attributes', () => {
    expect(LYNX_XML_SYSTEM_PROMPT).toContain(
      'accessibility-element to true',
    );
    expect(LYNX_XML_SYSTEM_PROMPT).toContain('accessibility-label');
    expect(LYNX_XML_SYSTEM_PROMPT).toContain('accessibility-traits');
    expect(LYNX_XML_SYSTEM_PROMPT).toContain(
      'never use Web aria-label',
    );
  });

  test('supports a validated engine version and caller appendix', () => {
    const prompt = buildLynxXmlSystemPrompt({
      engineVersion: ' 5.1 ',
      appendix: '  Prefer a compact information hierarchy.  ',
    });

    expect(prompt).toContain(
      'Set the <lynx> root\'s engine-version to "5.1".',
    );
    expect(prompt).not.toContain(
      'Set the <lynx> root\'s engine-version to "4.2".',
    );
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
