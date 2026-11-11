// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  animate,
  anticipate,
  backIn,
  backInOut,
  backOut,
  circIn,
  circInOut,
  circOut,
  createMotionValue,
  easeIn,
  easeInOut,
  easeOut,
  linear,
  spring,
  useMotionValueRef,
  useMotionValueRefEvent,
} from '@lynx-js/motion/mini';
import { runOnBackground, useMainThreadRef } from '@lynx-js/react';
import type { MainThread } from '@lynx-js/types';

import { assert, near, runCases, until, wait } from './checks.js' with {
  runtime: 'shared',
};
import { FeaturePage } from './harness.js';
import { readStyle } from './read-style.js' with { runtime: 'shared' };
import { useResults } from './use-results.js';

export default function MiniFeatures() {
  const box = useMainThreadRef<MainThread.Element>(null);
  const hookValue = useMotionValueRef(0);
  const hookChanges = useMainThreadRef(0);
  const [results, report] = useResults();
  useMotionValueRefEvent(hookValue, 'change', value => {
    'main thread';
    hookChanges.current++;
    box.current?.setStyleProperty('height', `${60 + value}px`);
  });

  async function run() {
    'main thread';
    const results = await runCases([
      ['all eleven easing exports', () => {
        for (
          const ease of [
            linear,
            anticipate,
            backIn,
            backInOut,
            backOut,
            circIn,
            circInOut,
            circOut,
            easeIn,
            easeInOut,
            easeOut,
          ]
        ) {
          near(ease(0), 0);
          near(ease(1), 1);
          assert(Number.isFinite(ease(0.37)), 'Invalid easing value');
        }
      }],
      ['tween, notifications, and completion', async () => {
        const value = createMotionValue(0);
        let updates = 0;
        let completed = 0;
        const unsubscribe = value.onChange(() => updates++);
        await animate(value, 50, {
          duration: 0.08,
          ease: easeInOut,
          onComplete: () => completed++,
        });
        near(value.get(), 50);
        near(value.getVelocity(), 0);
        assert(updates > 1 && completed === 1, 'Missing callbacks');
        assert(!value.isAnimating(), 'Animation is still attached');
        unsubscribe();
        value.destroy();
      }],
      ['setter and numeric inputs', async () => {
        let setter = 0;
        let numeric = 0;
        await animate(v => setter = v, 40, { from: 10, duration: 0.04 });
        await animate(10, 30, { duration: 0.04, onUpdate: v => numeric = v });
        near(setter, 40);
        near(numeric, 30);
      }],
      ['spring and spring generator', async () => {
        const value = createMotionValue(0);
        await animate(value, 1, {
          type: 'spring',
          stiffness: 500,
          damping: 40,
        });
        near(value.get(), 1);
        assert(!value.isAnimating(), 'Spring is still attached');
        assert(
          spring({ keyframes: [0, 1], stiffness: 500, damping: 40 }).next(5000)
            .done,
          'Unsettled solver',
        );
      }],
      ['stop settles and prevents writes', async () => {
        const value = createMotionValue(0);
        const controls = animate(value, 100, { duration: 0.5 });
        await until(() => value.get() > 0);
        controls.stop();
        const stopped = value.get();
        await controls;
        await wait(50);
        near(value.get(), stopped);
        assert(!value.isAnimating(), 'Stopped animation attached');
      }],
      ['replacement cancels old animation', async () => {
        const value = createMotionValue(0);
        const old = animate(value, 100, { duration: 0.5 });
        await until(() => value.get() > 0);
        await animate(value, 20, { duration: 0.06 });
        await old;
        await wait(50);
        near(value.get(), 20);
        assert(!value.isAnimating(), 'Old animation attached');
      }],
      ['destroy cancels and removes listeners', async () => {
        const value = createMotionValue(0);
        let changes = 0;
        value.on('change', () => changes++);
        const controls = animate(value, 100, { duration: 0.5 });
        await until(() => value.get() > 0);
        value.destroy();
        const before = changes;
        await controls;
        value.set(20);
        await wait(50);
        assert(
          changes === before && !value.isAnimating(),
          'Destroy leaked listeners or frames',
        );
      }],
      ['jump, unsubscribe, clear, and serialization', () => {
        const value = createMotionValue(0);
        let changes = 0;
        const unsubscribe = value.on('change', () => changes++);
        value.set(1);
        unsubscribe();
        value.set(2);
        value.onChange(() => changes++);
        value.clearListeners();
        value.jump(3);
        near(value.getVelocity(), 0);
        assert(
          changes === 1 && JSON.stringify(value) === '"3"',
          'Value semantics changed',
        );
      }],
      ['unsupported types reject explicitly', () => {
        for (const type of ['decay', 'keyframes'] as const) {
          let rejected = false;
          try {
            animate(0, 1, { type });
          } catch {
            rejected = true;
          }
          assert(rejected, `${type} was silently accepted`);
        }
      }],
      ['hook animation updates native element', async () => {
        await animate(hookValue.current, 40, { duration: 0.08 });
        await until(() => hookChanges.current > 0);
        near(hookValue.current.get(), 40);
        await until(() =>
          Math.abs(Number.parseFloat(readStyle(box.current!, 'height')) - 100)
            < 0.5
        );
      }],
    ]);
    void runOnBackground(report)(results);
  }

  return (
    <FeaturePage name='mini' results={results}>
      <view
        className='feature-run'
        main-thread:bindtap={() => {
          'main thread';
          void run();
        }}
      >
        <text>Run mini cases</text>
      </view>
      <view id='feature-box' className='feature-box' main-thread:ref={box} />
    </FeaturePage>
  );
}
