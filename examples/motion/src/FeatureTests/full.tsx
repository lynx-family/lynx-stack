// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  animate,
  clamp,
  mapValue,
  mix,
  motionValue,
  progress,
  spring,
  springValue,
  stagger,
  styleEffect,
  transformValue,
  useMotionValueRef,
  useMotionValueRefEvent,
} from '@lynx-js/motion';
import { runOnBackground, useMainThreadRef } from '@lynx-js/react';
import type { MainThread } from '@lynx-js/types';

import { assert, near, runCases, until, wait } from './checks.js' with {
  runtime: 'shared',
};
import { FeaturePage } from './harness.js';
import { readStyle } from './read-style.js' with { runtime: 'shared' };
import { useResults } from './use-results.js';

export default function FullFeatures() {
  const box = useMainThreadRef<MainThread.Element>(null);
  const groupA = useMainThreadRef<MainThread.Element>(null);
  const groupB = useMainThreadRef<MainThread.Element>(null);
  const hookValue = useMotionValueRef(0);
  const hookChanges = useMainThreadRef(0);
  const [results, report] = useResults();
  useMotionValueRefEvent(hookValue, 'change', () => {
    'main thread';
    hookChanges.current++;
  });

  async function run() {
    'main thread';
    const element = box.current!;
    const results = await runCases([
      ['number keyframes and completion', async () => {
        const value = motionValue(0);
        let updates = 0;
        let completed = 0;
        await animate(value, [0, 20, 40], {
          duration: 0.08,
          ease: 'linear',
          onUpdate: () => updates++,
          onComplete: () => completed++,
        });
        near(value.get(), 40);
        assert(updates > 1 && completed === 1, 'Missing lifecycle callbacks');
        value.destroy();
      }],
      ['color interpolation', async () => {
        let color = '';
        await animate('#000000', '#ffffff', {
          duration: 0.06,
          onUpdate: v => color = v,
        });
        assert(/#ffffff|255.*255.*255/i.test(color), color);
      }],
      ['element ref transform and opacity', async () => {
        await animate(element, { x: 40, scale: 1.2, opacity: 0.5 }, {
          duration: 0.08,
        });
        near(Number(readStyle(element, 'opacity')), 0.5);
        assert(readStyle(element, 'transform') !== 'none', 'Missing transform');
      }],
      ['selector, array, and stagger', async () => {
        await animate('.feature-group', { opacity: 1 }, {
          duration: 0.06,
          delay: stagger(0.025),
        });
        near(Number(readStyle(groupA.current!, 'opacity')), 1);
        near(Number(readStyle(groupB.current!, 'opacity')), 1);
        await animate([groupA.current!, groupB.current!], { opacity: 0.5 }, {
          duration: 0.04,
        });
        near(Number(readStyle(groupA.current!, 'opacity')), 0.5);
        near(Number(readStyle(groupB.current!, 'opacity')), 0.5);
      }],
      ['sequence and relative timing', async () => {
        const object = { x: 0, opacity: 0 };
        await animate([
          [object, { x: [0, 20] }, { duration: 0.04 }],
          [object, { x: 40, opacity: 1 }, { at: '+0.01', duration: 0.04 }],
        ]);
        near(object.x, 40);
        near(object.opacity, 1);
      }],
      ['pause, play, and complete', async () => {
        const value = motionValue(0);
        const controls = animate(value, 100, { duration: 0.5, ease: 'linear' });
        await until(() => value.get() > 0);
        controls.pause();
        await wait(50);
        const paused = value.get();
        await wait(50);
        near(value.get(), paused);
        controls.play();
        await until(() => value.get() > paused);
        controls.complete();
        await controls;
        near(value.get(), 100);
        value.destroy();
      }],
      ['stop and replacement', async () => {
        const value = motionValue(0);
        const controls = animate(value, 100, { duration: 0.5 });
        await until(() => value.get() > 0);
        controls.stop();
        const stopped = value.get();
        await wait(50);
        near(value.get(), stopped);
        const old = animate(value, 200, { duration: 0.5 });
        await animate(value, 20, { duration: 0.06 });
        await wait(50);
        near(value.get(), 20);
        old.stop();
        value.destroy();
      }],
      ['repeat reverse', async () => {
        const value = motionValue(0);
        await animate(value, 10, {
          duration: 0.04,
          repeat: 1,
          repeatType: 'reverse',
        });
        near(value.get(), 0);
        value.destroy();
      }],
      ['mapValue, transformValue, styleEffect cleanup', async () => {
        const source = motionValue(0);
        const mapped = mapValue(source, [0, 1], [0, 40]);
        const derived = transformValue(() => source.get() * 2);
        const cleanup = styleEffect(element, { opacity: derived, x: mapped });
        source.set(0.5);
        await until(() => Number(readStyle(element, 'opacity')) === 1);
        near(mapped.get(), 20);
        cleanup();
        source.set(1);
        await wait(50);
        near(Number(readStyle(element, 'opacity')), 1);
        mapped.destroy();
        derived.destroy();
        source.destroy();
      }],
      ['springValue source and unsubscribe', async () => {
        const source = motionValue(0);
        const value = springValue(source, { stiffness: 500, damping: 40 });
        let changes = 0;
        const unsubscribe = value.on('change', () => changes++);
        source.set(1);
        await until(() => Math.abs(value.get() - 1) < 0.001);
        assert(changes > 0, 'Spring did not notify');
        unsubscribe();
        const before = changes;
        value.jump(2);
        assert(changes === before, 'Unsubscribe did not detach');
        value.destroy();
        source.destroy();
      }],
      ['hook ref and hook change subscription', async () => {
        hookValue.current.set(1);
        await until(() => hookChanges.current > 0);
        near(hookValue.current.get(), 1);
      }],
      ['mix, clamp, progress, and spring generator', () => {
        near(clamp(0, 1, 3), 1);
        near(progress(10, 20, 15), 0.5);
        near(mix(0, 100, 0.25), 25);
        near(mix([0, 20], [20, 40])(0.5)[1]!, 30);
        const generator = spring({
          keyframes: [0, 1],
          stiffness: 300,
          damping: 30,
        });
        assert(generator.next(5000).done, 'Spring did not settle');
      }],
    ]);
    void runOnBackground(report)(results);
  }

  return (
    <FeaturePage name='full' results={results}>
      <view
        className='feature-run'
        main-thread:bindtap={() => {
          'main thread';
          void run();
        }}
      >
        <text>Run full cases</text>
      </view>
      <view id='feature-box' className='feature-box' main-thread:ref={box} />
      <view className='feature-group' main-thread:ref={groupA} />
      <view className='feature-group' main-thread:ref={groupB} />
    </FeaturePage>
  );
}
