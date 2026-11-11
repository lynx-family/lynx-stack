// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the root of this source tree.

import { expect, test, vi } from 'vitest';

import { runOnMainThread, useEffect } from '@lynx-js/react';
import { act, render } from '@lynx-js/react/testing-library';

import {
  useMotionTemplate,
  useMotionValue,
  useTransform,
} from '../src/index.js';
import { motionValueType } from '../src/hooks/useMotionValue.js';

test('range transforms and templates preserve first-frame values and update on the main thread', async () => {
  let update: (() => Promise<void>) | undefined;
  let read: (() => Promise<string>) | undefined;
  let initial: unknown;

  function App() {
    const source = useMotionValue(5);
    const x = useTransform(source, [0, 10], [0, 100]);
    const transform = useMotionTemplate`translate(${x}px, ${0}px)`;
    initial = motionValueType.downcast(transform)?.creationPayload;

    useEffect(() => {
      function updateSource() {
        'main thread';
        source.set(8);
      }

      function readTransform() {
        'main thread';
        return transform.get();
      }

      update = runOnMainThread(updateSource);
      read = runOnMainThread(readTransform);
    }, [source, transform]);

    return <view />;
  }

  render(<App />, { enableMainThread: true, enableBackgroundThread: true });

  expect(initial).toBe('translate(50px, 0px)');
  await act(async () => {
    await update!();
  });
  await vi.waitFor(async () => {
    expect(await read!()).toBe('translate(80px, 0px)');
  });
});
