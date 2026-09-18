// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from '@rstest/core';

import {
  LYNX_XML_ENGINE_VERSION,
  LYNX_XML_HTML_FRAGMENT_INSTRUCTIONS,
  LYNX_XML_HTML_FRAGMENT_SYSTEM_PROMPT,
  LYNX_XML_SYSTEM_PROMPT,
  buildLynxXmlSystemPrompt,
} from '../src/index.js';

function localContracts(enableHtmlFragment: boolean): string {
  const [, contracts = ''] = buildLynxXmlSystemPrompt({ enableHtmlFragment })
    .split('\nLynx XML adaptation contract:\n');
  return contracts.replace(/\s+/gu, ' ');
}

describe('buildLynxXmlSystemPrompt', () => {
  test('builds the exported default prompt', () => {
    expect(LYNX_XML_ENGINE_VERSION).toBe('4.2');
    expect(LYNX_XML_SYSTEM_PROMPT).toBe(buildLynxXmlSystemPrompt());
  });

  test('builds the one-pass fragment prompt without conversion tools or returned bindings', () => {
    expect(LYNX_XML_HTML_FRAGMENT_SYSTEM_PROMPT).toBe(buildLynxXmlSystemPrompt({
      enableHtmlFragment: true,
    }));
    expect(LYNX_XML_SYSTEM_PROMPT).not.toContain('XML fragment mode');
    expect(LYNX_XML_HTML_FRAGMENT_SYSTEM_PROMPT).toContain(
      'nodes = createFragment(page, pageId)',
    );
    expect(LYNX_XML_HTML_FRAGMENT_SYSTEM_PROMPT).toContain('nodes["cityText"]');
    expect(LYNX_XML_HTML_FRAGMENT_SYSTEM_PROMPT).toContain(
      LYNX_XML_HTML_FRAGMENT_INSTRUCTIONS,
    );
    expect(LYNX_XML_HTML_FRAGMENT_SYSTEM_PROMPT.indexOf('XML fragment mode'))
      .toBeLessThan(
        LYNX_XML_HTML_FRAGMENT_SYSTEM_PROMPT.indexOf(
          '### references/lynxml.md',
        ),
      );
    expect(LYNX_XML_HTML_FRAGMENT_SYSTEM_PROMPT).toContain('unique id ONLY');
    expect(LYNX_XML_HTML_FRAGMENT_SYSTEM_PROMPT).toContain(
      'Omit id on purely static nodes',
    );
    expect(LYNX_XML_HTML_FRAGMENT_SYSTEM_PROMPT).toContain(
      'Prefer literal text directly inside <text>',
    );
    expect(LYNX_XML_HTML_FRAGMENT_SYSTEM_PROMPT).toContain(
      'An explicit <raw-text> leaf',
    );
    expect(LYNX_XML_HTML_FRAGMENT_SYSTEM_PROMPT).toContain(
      'without another model request',
    );
    expect(LYNX_XML_HTML_FRAGMENT_SYSTEM_PROMPT).not.toContain(
      'html_fragment_to_main_thread_script',
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

  test.each([false, true])(
    'requires explicit helper dependencies in both output modes (fragment: %s)',
    enableHtmlFragment => {
      const prompt = localContracts(enableHtmlFragment);
      expect(prompt).toContain(
        'Pass parent nodes and render-local dependencies as helper parameters',
      );
      expect(prompt).toContain(
        'call(), apply(), and bind() do not expose caller-local variables',
      );
      expect(prompt).toContain(
        'Keep shared state and node references in scope for render, event, update, and cleanup handlers',
      );
      expect(prompt).toContain(
        'initialize before use and verify all identifier bindings',
      );
    },
  );

  test.each([false, true])(
    'keeps node references separate from ids (fragment: %s)',
    enableHtmlFragment => {
      const prompt = localContracts(enableHtmlFragment);
      expect(prompt).toContain(
        '__AppendElement and append helpers accept node references, never numeric ids',
      );
      expect(prompt).toContain(
        'Use pageId only as the first argument to page-owned creation APIs',
      );
    },
  );

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
    const prompt = localContracts(false);
    expect(prompt).toContain(
      'Apply classes with display: flex and explicit flex-direction: row or column',
    );
    expect(prompt).toContain('not inline styles or implicit layout');
    expect(prompt).toContain('Leaf text and images are exempt');
    expect(LYNX_XML_SYSTEM_PROMPT).not.toContain(
      'Prefer it for simple columns',
    );
    expect(LYNX_XML_SYSTEM_PROMPT).toContain(
      'Function, fetchBundle, loadScript',
    );
  });

  test.each([false, true])(
    'keeps the direct Page scroll-view and fixed-bar contracts (fragment: %s)',
    enableHtmlFragment => {
      const prompt = localContracts(enableHtmlFragment);
      expect(prompt).toContain('Keep Page visually unstyled');
      expect(prompt).toContain(
        'Use __CreateView(pageId) only when content fits one viewport',
      );
      expect(prompt).toContain(
        'append __CreateScrollView(pageId) as Page\'s first business child, never below a business view',
      );
      expect(prompt).toContain(
        'scroll-orientation to "vertical" with __SetAttribute',
      );
      expect(prompt).toContain(
        'width: 100%, a definite height such as 100vh, and flex-direction: column',
      );
      expect(prompt).toContain('one growing wrapper without 100vh');
      expect(prompt).toContain('Do not nest vertical scroll views');
      expect(prompt).toContain(
        'Fixed bars are direct Page children beside the scroll view',
      );
      expect(prompt).toContain(
        'reserve their full size and host-supplied safe-area insets in scrolling content',
      );
    },
  );

  test.each([false, true])(
    'allows approved resource URLs while preserving artifact boundaries (fragment: %s)',
    enableHtmlFragment => {
      const prompt = localContracts(enableHtmlFragment);
      expect(prompt).toContain('Artifact boundaries:');
      expect(prompt).toContain(
        'no imports, package dependencies, eval, Function, fetchBundle, loadScript, analytics, or tracking',
      );
      expect(prompt).toContain(
        'Use only asset/link URLs supplied by the user or host, or returned by enabled search/image tools',
      );
      expect(prompt).toContain('Never invent URLs or execute external scripts');
      expect(prompt).toContain(
        'background-thread data fetching only for explicitly requested integrations',
      );
      expect(prompt).toContain('Do not claim device testing');
      expect(prompt).not.toContain('Product and safety requirements:');
      expect(prompt).not.toContain('Produce a polished, responsive interface');
    },
  );

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
