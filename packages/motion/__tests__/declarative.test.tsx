// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { beforeEach, describe, expect, test, vi } from 'vitest';

import { useState } from '@lynx-js/react';
import type { IntrinsicElements } from '@lynx-js/types';
import { act, fireEvent, render } from '@lynx-js/react/testing-library';

import { motion, useMotionValue } from '../src/index.js';
import type { MotionStyle, MotionTarget } from '../src/declarative/types.js';
import { ElementCompt } from '../src/polyfill/element.js';
import {
  collectMotionValues,
  resolveInitialStyle,
  resolveMotionDefinition,
  splitMotionTarget,
} from '../src/declarative/style.js';

describe('declarative Motion', () => {
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

  test('uses the final animate state when initial is false', () => {
    expect(
      resolveInitialStyle(
        { width: '100px' },
        false,
        { opacity: [0, 1], x: [0, 24] },
      ),
    ).toEqual({
      width: '100px',
      opacity: 1,
      transform: 'translateX(24px)',
    });
  });

  test('preserves typed CSS custom properties in initial styles', () => {
    const style: MotionStyle = { '--motion-color': '#fff' };
    const target: MotionTarget = { '--motion-color': '#000' };

    expect(resolveInitialStyle(style, target)).toEqual({
      '--motion-color': '#000',
    });
  });

  test('uses a MotionValue handle initial value in the first style', () => {
    let scale: ReturnType<typeof useMotionValue> | undefined;
    let initialStyle: ReturnType<typeof resolveInitialStyle>;
    let motionValues: ReturnType<typeof collectMotionValues>;
    function App() {
      scale = useMotionValue(1.25);
      initialStyle = resolveInitialStyle({ scale } as never, undefined);
      motionValues = collectMotionValues({ scale } as never);
      return <view />;
    }

    render(<App />, {
      enableMainThread: true,
      enableBackgroundThread: true,
    });

    expect(initialStyle).toEqual({
      transform: 'scale(1.25)',
    });
    expect(motionValues).toBeDefined();
    expect(motionValues?.['scale']).toBe(scale);
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
      transitionEnd: undefined,
    });
  });

  test('separates transitionEnd from animated values', () => {
    expect(
      splitMotionTarget(
        {
          x: 20,
          transition: { duration: 0.2 },
          transitionEnd: { x: 100 },
        },
        undefined,
      ),
    ).toEqual({
      target: { x: 20 },
      transition: { duration: 0.2 },
      transitionEnd: { x: 100 },
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

  test('switches display to none only after an opacity exit completes', async () => {
    function App() {
      const [hidden, setHidden] = useState(false);
      return (
        <view>
          <motion.view
            data-testid='box'
            initial={{ display: 'block', opacity: 1 }}
            animate={hidden
              ? { display: 'none', opacity: 0 }
              : { display: 'block', opacity: 1 }}
            transition={{ duration: 0.08, ease: 'linear' }}
          />
          <view data-testid='toggle' bindtap={() => setHidden(true)} />
        </view>
      );
    }

    const { getByTestId } = render(<App />, {
      enableMainThread: true,
      enableBackgroundThread: true,
    });

    fireEvent.tap(getByTestId('toggle'));
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 30));
    });
    expect(getByTestId('box').getAttribute('style')).toContain(
      'display: block',
    );
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 80));
    });
    expect(getByTestId('box').getAttribute('style')).toContain('display: none');
  });

  test('switches visibility to hidden only after an opacity exit completes', async () => {
    function App() {
      const [hidden, setHidden] = useState(false);
      return (
        <view>
          <motion.view
            data-testid='box'
            initial={{ visibility: 'visible', opacity: 1 }}
            animate={hidden
              ? { visibility: 'hidden', opacity: 0 }
              : { visibility: 'visible', opacity: 1 }}
            transition={{ duration: 0.08, ease: 'linear' }}
          />
          <view data-testid='toggle' bindtap={() => setHidden(true)} />
        </view>
      );
    }

    const { getByTestId } = render(<App />, {
      enableMainThread: true,
      enableBackgroundThread: true,
    });

    fireEvent.tap(getByTestId('toggle'));
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 30));
    });
    expect(getByTestId('box').getAttribute('style')).toContain(
      'visibility: visible',
    );
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 80));
    });
    expect(getByTestId('box').getAttribute('style')).toContain(
      'visibility: hidden',
    );
  });

  test('routes value-specific transitions by animated property', async () => {
    function App() {
      const [active, setActive] = useState(false);
      return (
        <view>
          <motion.view
            data-testid='box'
            initial={{ opacity: 0, x: 0 }}
            animate={{ opacity: active ? 1 : 0, x: active ? 40 : 0 }}
            transition={{
              opacity: { duration: 0.01, ease: 'linear' },
              x: { delay: 0.08, duration: 0.01, ease: 'linear' },
            }}
          />
          <view data-testid='toggle' bindtap={() => setActive(true)} />
        </view>
      );
    }

    const { getByTestId } = render(<App />, {
      enableMainThread: true,
      enableBackgroundThread: true,
    });

    fireEvent.tap(getByTestId('toggle'));
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 40));
    });

    expect(getByTestId('box').getAttribute('style')).toContain('opacity: 1');
    expect(getByTestId('box').getAttribute('style')).not.toContain(
      'translateX(40px)',
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 80));
    });
    expect(getByTestId('box').getAttribute('style')).toContain(
      'translateX(40px)',
    );
  });

  test('applies the latest transitionEnd after animation', async () => {
    function App() {
      const [step, setStep] = useState(0);
      return (
        <view>
          <motion.view
            data-testid='box'
            initial={{ x: 0 }}
            animate={{
              x: step * 20,
              transition: { type: false },
              transitionEnd: { x: step * 100 },
            }}
          />
          <view
            data-testid='toggle'
            bindtap={() => {
              setStep(1);
              setStep(2);
            }}
          />
        </view>
      );
    }

    const { getByTestId } = render(<App />, {
      enableMainThread: true,
      enableBackgroundThread: true,
    });

    fireEvent.tap(getByTestId('toggle'));
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
    });
    expect(getByTestId('box').getAttribute('style')).toContain(
      'translateX(200px)',
    );
  });

  test('does not complete an animation after unmount', async () => {
    const onAnimationComplete = vi.fn();
    function App() {
      const [visible, setVisible] = useState(true);
      return (
        <view>
          {visible
            ? (
              <motion.view
                data-testid='box'
                initial={{ x: 0 }}
                animate={{ x: 40 }}
                transition={{ duration: 0.08 }}
                onAnimationComplete={onAnimationComplete}
              />
            )
            : null}
          <view data-testid='toggle' bindtap={() => setVisible(false)} />
        </view>
      );
    }

    const { getByTestId } = render(<App />, {
      enableMainThread: true,
      enableBackgroundThread: true,
    });
    fireEvent.tap(getByTestId('toggle'));
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 120));
    });
    expect(onAnimationComplete).not.toHaveBeenCalled();
  });

  test('restores a static style when its animate value is removed', async () => {
    function App() {
      const [ownsOpacity, setOwnsOpacity] = useState(true);
      return (
        <view>
          <motion.view
            data-testid='box'
            style={{ opacity: 0.35 }}
            animate={ownsOpacity ? { opacity: 1 } : {}}
            transition={{ type: false }}
          />
          <view
            data-testid='toggle'
            bindtap={() => setOwnsOpacity(false)}
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
    expect(getByTestId('box').getAttribute('style')).toContain('opacity: 1');

    fireEvent.tap(getByTestId('toggle'));
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
    });
    expect(getByTestId('box').getAttribute('style')).toContain(
      'opacity: 0.35',
    );
  });

  test('skips the mount animation when initial is false', async () => {
    const onMountAnimationStart = vi.fn();
    const onMountAnimationComplete = vi.fn();
    const onUpdateAnimationStart = vi.fn();

    function App() {
      const [active, setActive] = useState(false);
      return (
        <view>
          <motion.view
            data-testid='box'
            initial={false}
            animate={{ opacity: 1, x: active ? 48 : [0, 24] }}
            transition={{ duration: 0.01 }}
            onAnimationStart={active
              ? onUpdateAnimationStart
              : onMountAnimationStart}
            onAnimationComplete={active ? undefined : onMountAnimationComplete}
          />
          <view
            data-testid='toggle'
            bindtap={() => setActive(true)}
          />
        </view>
      );
    }

    const { getByTestId } = render(<App />, {
      enableMainThread: true,
      enableBackgroundThread: true,
    });

    expect(getByTestId('box').getAttribute('style')).toContain('opacity: 1');
    expect(getByTestId('box').getAttribute('style')).toContain(
      'translateX(24px)',
    );
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
    });
    expect(onMountAnimationStart).not.toHaveBeenCalled();
    expect(onMountAnimationComplete).not.toHaveBeenCalled();

    fireEvent.tap(getByTestId('toggle'));
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
    });
    expect(getByTestId('box').getAttribute('style')).toContain(
      'translateX(48px)',
    );
    expect(onUpdateAnimationStart).toHaveBeenCalledOnce();
  });

  test('animates a MotionValue-backed style', async () => {
    function App() {
      const value = useMotionValue(1);
      return (
        <motion.view
          data-testid='box'
          animate={{ scale: 1.5 }}
          transition={{ duration: 0.01 }}
          style={{ scale: value }}
        />
      );
    }

    const { getByTestId } = render(<App />, {
      enableMainThread: true,
      enableBackgroundThread: true,
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    expect(getByTestId('box').getAttribute('style')).toContain('scale(1.5)');
  });

  test('updates a MotionValue-backed style from a background event', async () => {
    function App() {
      const x = useMotionValue(-36);
      function move() {
        x.set(36);
      }
      return (
        <motion.view
          data-testid='box'
          bindtap={move}
          style={{ x }}
        />
      );
    }

    const { getByTestId } = render(<App />, {
      enableMainThread: true,
      enableBackgroundThread: true,
    });

    expect(getByTestId('box').getAttribute('style')).toContain(
      'translateX(-36px)',
    );
    fireEvent.tap(getByTestId('box'));
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    expect(getByTestId('box').getAttribute('style')).toContain(
      'translateX(36px)',
    );
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

    expect(getByTestId('button').getAttribute('style')).toContain(
      'transform: scale(1, 1);',
    );
    expect(getByTestId('button').getAttribute('style')).toContain(
      'rgb(255, 255, 255)',
    );
  });

  test('applies and restores a tap transitionEnd value', async () => {
    const { getByTestId } = render(
      <motion.view
        data-testid='button'
        style={{ opacity: 1 }}
        whileTap={{
          opacity: 0.5,
          transitionEnd: { opacity: 0.75 },
        }}
        transition={{ duration: 0.01 }}
      />,
      { enableMainThread: true, enableBackgroundThread: true },
    );

    fireEvent.touchstart(getByTestId('button'));
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
    });
    expect(getByTestId('button').getAttribute('style')).toContain(
      'opacity: 0.75',
    );

    fireEvent.touchend(getByTestId('button'));
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
    });
    expect(getByTestId('button').getAttribute('style')).toContain('opacity: 1');
  });

  test('uses the initial transition when a tap restores its base value', async () => {
    const { getByTestId } = render(
      <motion.view
        data-testid='button'
        initial={{ opacity: 1, transition: { type: false } }}
        whileTap={{ opacity: 0.5, transition: { duration: 1 } }}
      />,
      { enableMainThread: true, enableBackgroundThread: true },
    );

    fireEvent.touchstart(getByTestId('button'));
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 30));
    });
    expect(getByTestId('button').getAttribute('style')).not.toContain(
      'opacity: 1',
    );

    fireEvent.touchend(getByTestId('button'));
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 30));
    });
    expect(getByTestId('button').getAttribute('style')).toContain('opacity: 1');
  });

  test('restores every value after interrupting a tap animation', async () => {
    const { getByTestId } = render(
      <motion.view
        data-testid='button'
        style={{ scale: 1, backgroundColor: '#ffffff' }}
        whileTap={{ scale: 1.15, backgroundColor: '#ffcc00' }}
        transition={{ duration: 0.2 }}
      />,
      { enableMainThread: true, enableBackgroundThread: true },
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
    });
    fireEvent.touchstart(getByTestId('button'));
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
    });
    expect(getByTestId('button').getAttribute('style')).not.toContain(
      'rgb(255, 255, 255)',
    );
    fireEvent.touchend(getByTestId('button'));
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 300));
    });
    expect(getByTestId('button').getAttribute('style')).toContain(
      'transform: scale(1, 1);',
    );
    expect(getByTestId('button').getAttribute('style')).toContain(
      'rgb(255, 255, 255)',
    );
  });

  test('composes gesture callbacks with external host handlers', () => {
    const onTapStart = vi.fn();
    const onTap = vi.fn();
    const onTapCancel = vi.fn();
    const externalTouchStart = vi.fn();
    const externalTouchEnd = vi.fn();
    const externalTouchCancel = vi.fn();
    const { getByTestId } = render(
      <motion.view
        data-testid='button'
        onTapStart={onTapStart}
        onTap={onTap}
        onTapCancel={onTapCancel}
        bindtouchstart={externalTouchStart}
        bindtouchend={externalTouchEnd}
        bindtouchcancel={externalTouchCancel}
      />,
      { enableMainThread: true, enableBackgroundThread: true },
    );

    fireEvent.touchstart(getByTestId('button'));
    expect(onTapStart).toHaveBeenCalledOnce();
    expect(externalTouchStart).toHaveBeenCalledOnce();

    fireEvent.touchend(getByTestId('button'));
    expect(onTap).toHaveBeenCalledOnce();
    expect(externalTouchEnd).toHaveBeenCalledOnce();

    fireEvent.touchstart(getByTestId('button'));
    fireEvent.touchcancel(getByTestId('button'));
    expect(onTapStart).toHaveBeenCalledTimes(2);
    expect(externalTouchStart).toHaveBeenCalledTimes(2);
    expect(onTap).toHaveBeenCalledOnce();
    expect(onTapCancel).toHaveBeenCalledOnce();
    expect(externalTouchCancel).toHaveBeenCalledOnce();
  });
});
