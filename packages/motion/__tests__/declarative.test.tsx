// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { beforeEach, describe, expect, test } from 'vitest';

import { useState } from '@lynx-js/react';
import type { IntrinsicElements } from '@lynx-js/types';
import { act, fireEvent, render } from '@lynx-js/react/testing-library';

import { motion, useMotionValue } from '../src/index.js';
import { ElementCompt } from '../src/polyfill/element.js';
import {
  collectMotionValues,
  resolveInitialStyle,
  resolveMotionDefinition,
  splitMotionTarget,
} from '../src/declarative/style.js';

describe('declarative Motion', () => {
  beforeEach(() => {
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
  });

  test('resolves initial styles and transform aliases', () => {
    expect(
      resolveInitialStyle(
        { width: '100px', x: 4 },
        { opacity: 0, x: -20, scale: 0.5 },
      ),
    ).toEqual({
      width: '100px',
      opacity: 0,
      transform: 'translateX(-20px) scale(0.5)',
    });
  });

  test('uses a MotionValue handle initial value in the first style', () => {
    const scale = {
      __MAIN_THREAD_VALUE__: true as const,
      toJSON: () => ({
        _wvid: 1,
        _initValue: 1.25,
        _type: '@lynx-js/motion/MotionValue',
      }),
    };

    expect(resolveInitialStyle({ scale } as never, undefined)).toEqual({
      transform: 'scale(1.25)',
    });
    expect(collectMotionValues({ scale } as never)).toEqual({ scale });
  });

  test('resolves named and function variants with target transitions', () => {
    const definition = resolveMotionDefinition(
      ['base', 'active'],
      {
        base: { opacity: 0.5, x: 0 },
        active: custom => ({
          x: Number(custom),
          transition: { duration: 0.2 },
        }),
      },
      80,
    );

    expect(splitMotionTarget(definition, { duration: 1 })).toEqual({
      target: { opacity: 0.5, x: 80 },
      transition: { duration: 0.2 },
    });
  });

  test('renders initial styles without forwarding Motion props', () => {
    const { container } = render(
      <motion.view
        data-testid='box'
        initial={{ opacity: 0, x: -30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.01 }}
        style={{ width: '100px', height: '100px' }}
      />,
      { enableMainThread: true, enableBackgroundThread: true },
    );

    expect(container.firstChild).toMatchInlineSnapshot(`
      <view
        data-testid="box"
        has-react-ref="true"
        style="width: 100px; height: 100px; opacity: 0; transform: translateX(-30px);"
      />
    `);
  });

  test('wraps components that forward host props', () => {
    function Card(props: IntrinsicElements['view']) {
      return <view {...props} />;
    }
    const MotionCard = motion.create(Card);

    const { getByTestId } = render(
      <MotionCard data-testid='card' initial={{ opacity: 0.25 }} />,
      { enableMainThread: true, enableBackgroundThread: true },
    );

    expect(getByTestId('card').getAttribute('style')).toContain(
      'opacity: 0.25',
    );
  });

  test('animates when a declarative target changes', async () => {
    function App() {
      const [active, setActive] = useState(false);
      return (
        <view>
          <motion.view
            data-testid='box'
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: active ? 80 : 0 }}
            transition={{ duration: 0.01 }}
            style={{ width: '100px', height: '100px' }}
          />
          <view
            data-testid='toggle'
            bindtap={() => setActive(value => !value)}
          />
        </view>
      );
    }

    const { getByTestId } = render(<App />, {
      enableMainThread: true,
      enableBackgroundThread: true,
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
    });
    fireEvent.tap(getByTestId('toggle'));
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    expect(getByTestId('box').getAttribute('style')).toContain(
      'translateX(80px)',
    );
  });

  test('updates styles directly from a MotionValue', async () => {
    function App() {
      const [active, setActive] = useState(false);
      const scale = useMotionValue(1);

      function grow() {
        'main thread';
        scale.set(1.5);
        (globalThis as { __motionValueResult?: number }).__motionValueResult =
          scale.get();
      }

      return (
        <view>
          <motion.view
            data-testid='box'
            initial={{ x: 0 }}
            animate={{ x: active ? 80 : 0 }}
            transition={{ duration: 0.01 }}
            style={{ scale }}
            main-thread:bindtap={grow}
          />
          <view
            data-testid='toggle'
            bindtap={() => setActive(value => !value)}
          />
        </view>
      );
    }

    const { getByTestId } = render(<App />, {
      enableMainThread: true,
      enableBackgroundThread: true,
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
    });
    fireEvent.tap(getByTestId('toggle'));
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
    });
    fireEvent.tap(getByTestId('box'));
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    expect(
      (globalThis as { __motionValueResult?: number }).__motionValueResult,
    ).toBe(1.5);
    expect(getByTestId('box').getAttribute('style')).toContain(
      'translateX(80px)',
    );
    expect(getByTestId('box').getAttribute('style')).toContain('scale(1.5)');
    delete (globalThis as { __motionValueResult?: number }).__motionValueResult;
  });

  test('animates while pressed and restores the resting style', async () => {
    const { getByTestId } = render(
      <motion.view
        data-testid='button'
        style={{ backgroundColor: '#ffffff' }}
        whileTap={{ scale: 1.15, backgroundColor: '#ffcc00' }}
        transition={{ duration: 0.01 }}
      />,
      { enableMainThread: true, enableBackgroundThread: true },
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
    });
    fireEvent.touchstart(getByTestId('button'));
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    expect(getByTestId('button').getAttribute('style')).toContain(
      'scale(1.15',
    );
    expect(getByTestId('button').getAttribute('style')).toContain(
      'rgb(255, 204, 0)',
    );

    fireEvent.touchend(getByTestId('button'));
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    expect(getByTestId('button').getAttribute('style')).toContain('scale(1');
    expect(getByTestId('button').getAttribute('style')).toContain(
      'rgb(255, 255, 255)',
    );
  });
});
