// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from 'vitest';

import {
  runOnMainThread,
  useEffect,
  useMainThreadCallable,
  useMainThreadCallables,
} from '@lynx-js/react';
import { act, render } from '@lynx-js/react/testing-library';

import { animate } from '../src/mini/index.js';

declare global {
  // eslint-disable-next-line no-var
  var easeInvocations: number[];
  // eslint-disable-next-line no-var
  var animatedValues: number[];
  // eslint-disable-next-line no-var
  var templateFrames: string[];
}

describe('main-thread callable transport', () => {
  // Mirrors Huxpro/motion#37: a consumer easing closure nested inside a
  // transition object must arrive on the main thread as a callable function
  // and drive the animation engine unchanged.
  test('consumer easing nested in a transition object drives animate', async () => {
    const plateau = 0.5;
    const App = () => {
      const transition = useMainThreadCallables({
        duration: 0.1,
        ease: (progress: number) => {
          'main thread';
          globalThis.easeInvocations.push(progress);
          // The captured `plateau` comes from the background render.
          return plateau;
        },
      });
      useEffect(() => {
        void runOnMainThread((options: typeof transition) => {
          'main thread';
          globalThis.easeInvocations = [];
          globalThis.animatedValues = [];
          animate((v: number) => {
            globalThis.animatedValues.push(v);
          }, 100, { ...options, from: 0 });
        })(transition);
      }, []);
      return <view />;
    };

    render(<App />, {
      enableMainThread: true,
      enableBackgroundThread: true,
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
    });

    // The consumer easing executed on the main thread...
    expect(globalThis.easeInvocations.length).toBeGreaterThan(0);
    // ...every intermediate frame reflects its captured plateau value
    // (the final frames are pinned to the exact target by animate)...
    const values = globalThis.animatedValues;
    expect(values.length).toBeGreaterThan(0);
    expect(new Set(values)).toEqual(new Set([50, 100]));
    // ...and the animation settles at the final target.
    expect(values.at(-1)).toBe(100);
  });

  // Mirrors Huxpro/motion#55: a consumer transformTemplate composes custom
  // transform text around the generated transform on every frame of a real
  // animation, receiving the latest values.
  test('transformTemplate composes around the generated transform each frame', async () => {
    const App = () => {
      const transformTemplate = useMainThreadCallable(
        (latest: { x: number }, generated: string) => {
          'main thread';
          return `translateY(${latest.x}px) ${generated}`;
        },
      );
      useEffect(() => {
        void runOnMainThread((template: typeof transformTemplate) => {
          'main thread';
          globalThis.templateFrames = [];
          animate((x: number) => {
            const generated = `translateX(${x}px)`;
            globalThis.templateFrames.push(template!({ x }, generated));
          }, 30, { duration: 0.1, ease: (t: number) => t, from: 0 });
        })(transformTemplate);
      }, []);
      return <view />;
    };

    render(<App />, {
      enableMainThread: true,
      enableBackgroundThread: true,
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
    });

    expect(globalThis.templateFrames.length).toBeGreaterThan(0);
    expect(globalThis.templateFrames.at(-1)).toBe(
      'translateY(30px) translateX(30px)',
    );
  });
});
