// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { beforeEach, describe, expect, test } from 'vitest';

import { act, render } from '@lynx-js/react/testing-library';
import { motion } from '@lynx-js/motion';

import { ElementCompt } from '../src/polyfill/element.js';

declare global {
  // eslint-disable-next-line no-var
  var inferredEaseSegments: string[];
}

describe('zero-directive Motion conformance', () => {
  beforeEach(() => {
    globalThis.SystemInfo = { platform: 'web' } as typeof SystemInfo;
    globalThis.NodeList ??= class NodeList {} as typeof NodeList;
    globalThis.SVGElement ??= class SVGElement {} as typeof SVGElement;
    globalThis.Element = ElementCompt as unknown as typeof Element;
    globalThis.HTMLElement = ElementCompt as unknown as typeof HTMLElement;
    globalThis.EventTarget = ElementCompt as unknown as typeof EventTarget;
    const getComputedStyle = (element: Element): CSSStyleDeclaration =>
      element instanceof ElementCompt
        ? element.getComputedStyle() as unknown as CSSStyleDeclaration
        : (element as HTMLElement).style;
    globalThis.getComputedStyle = getComputedStyle;
    globalThis.window.getComputedStyle = getComputedStyle;
    globalThis.inferredEaseSegments = [];
  });

  test('runs an upstream easing-function array unchanged', async () => {
    const { getByTestId } = render(
      <motion.div
        data-testid='box'
        initial={{ x: -42 }}
        animate={{ x: [-42, 0, 42] }}
        transition={{
          duration: 0.1,
          ease: [
            (progress) => {
              globalThis.inferredEaseSegments.push('first');
              return progress;
            },
            (progress) => {
              globalThis.inferredEaseSegments.push('second');
              return progress;
            },
          ],
        }}
      />,
      { enableMainThread: true, enableBackgroundThread: true },
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 300));
    });

    expect(globalThis.inferredEaseSegments).toContain('first');
    expect(globalThis.inferredEaseSegments).toContain('second');
    expect(getByTestId('box').getAttribute('style')).toContain(
      'translateX(42px)',
    );
  });

  test('applies upstream transformTemplate code unchanged', async () => {
    const { getByTestId } = render(
      <motion.div
        data-testid='box'
        initial={{ x: 10 }}
        animate={{ x: 30 }}
        transition={{ duration: 0.1 }}
        transformTemplate={({ x }, generated) =>
          `translateY(${x}) ${generated}`}
      />,
      { enableMainThread: true, enableBackgroundThread: true },
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 300));
    });

    expect(getByTestId('box').getAttribute('style')).toBe(
      'transform: translateY(30px) translateX(30px);',
    );
  });
});
