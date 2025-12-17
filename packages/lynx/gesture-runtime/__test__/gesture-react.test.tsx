// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { MockInstance } from 'vitest';

import { useState } from '@lynx-js/react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitSchedule,
} from '@lynx-js/react/testing-library';

import {
  DefaultScrollGesture,
  FlingGesture,
  Gesture,
  GestureTypeInner,
  LongPressGesture,
  PanGesture,
  TapGesture,
} from '../src/index.js';
import type { ComposedGesture } from '../src/index.js';
import { useGesture } from '../src/useGesture.js';
import { DEFAULT_DISTANCE } from '../src/utils/const.js';

const MainThreadFunction = function() {
  'main thread';
};

describe('create gesture', () => {
  test('gesture type', () => {
    const panGesture = new PanGesture();
    const flingGesture = new FlingGesture();
    const tapGesture = new TapGesture();
    const longPressGesture = new LongPressGesture();

    expect(panGesture.type).toBe(GestureTypeInner.PAN);
    expect(flingGesture.type).toBe(GestureTypeInner.FLING);
    expect(tapGesture.type).toBe(GestureTypeInner.TAP);
    expect(longPressGesture.type).toBe(GestureTypeInner.LONGPRESS);
  });

  test('gesture config', () => {
    const panGesture = new PanGesture();
    panGesture.minDistance(100);

    expect(panGesture.config.minDistance).toBe(100);

    const longPressGesture = new LongPressGesture();
    longPressGesture.minDuration(1000);
    longPressGesture.maxDistance(200);

    expect(longPressGesture.config.minDuration).toBe(1000);
    expect(longPressGesture.config.maxDistance).toBe(200);

    const tapGesture = new TapGesture();
    tapGesture.maxDuration(1000);
    tapGesture.maxDistance(200);

    expect(tapGesture.config.maxDuration).toBe(1000);
    expect(tapGesture.config.maxDistance).toBe(200);
  });

  test('gesture callback', () => {
    const panGesture = new PanGesture();
    panGesture.onUpdate(MainThreadFunction);

    expect(panGesture.callbacks.onUpdate).toMatchObject({});
  });

  test('gesture non main thread callback', () => {
    const panGesture = new PanGesture();

    expect(() =>
      panGesture.onUpdate((event) => {
        // Non Main Thread Callback
      })
    ).toThrow(
      `Gesture callback for 'onUpdate' must be a main thread function`,
    );
  });

  test('clone should have equal properties', () => {
    const defaultScrollGesture = new DefaultScrollGesture();
    defaultScrollGesture.tapSlop(100);

    const cloned = defaultScrollGesture.clone();

    expect(cloned).toMatchObject(defaultScrollGesture);
  });
});

describe('useGesture', () => {
  test('useGesture should create gesture instance', () => {
    let _panGesture;
    let _tapGesture;
    let _flingGesture;
    let _longPressGesture;

    const App = () => {
      const panGesture = useGesture(PanGesture);
      const tapGesture = useGesture(TapGesture);
      const flingGesture = useGesture(FlingGesture);
      const longPressGesture = useGesture(LongPressGesture);

      _panGesture = panGesture;
      _tapGesture = tapGesture;
      _flingGesture = flingGesture;
      _longPressGesture = longPressGesture;
      return <view main-thread:gesture={panGesture}></view>;
    };

    const { container } = render(<App />);

    expect(_panGesture).toBeInstanceOf(PanGesture);
    expect(_tapGesture).toBeInstanceOf(TapGesture);
    expect(_flingGesture).toBeInstanceOf(FlingGesture);
    expect(_longPressGesture).toBeInstanceOf(LongPressGesture);
  });

  test('useGesture should create different instance when updated', async () => {
    let _panGesture;
    let prevPanExecId = 0;
    let _setCurrent;

    const App = () => {
      const panGesture = useGesture(PanGesture);
      const [current, setCurrent] = useState(0);

      _setCurrent = setCurrent;

      panGesture.onBegin(() => {
        'main thread';
        // empty callback
      });

      _panGesture = panGesture;
      return <view main-thread:gesture={panGesture}></view>;
    };

    await act(() => {
      const { container } = render(<App />);
    });

    prevPanExecId = _panGesture;

    await act(() => {
      _setCurrent(20);
    });

    expect(_panGesture).not.toBe(prevPanExecId);
  });
});

describe('gestures mt', () => {
  let spySetGesture: MockInstance;

  beforeEach(() => {
    spySetGesture = vi.spyOn(
      lynxTestingEnv.mainThread.globalThis,
      '__SetGestureDetector',
    );
  });

  afterEach(() => {
    spySetGesture.mockRestore();
  });

  test('bind gestures should call __SetGestureDetector correctly', async () => {
    let _panGesture;

    const App = () => {
      const panGesture = useGesture(PanGesture);

      _panGesture = panGesture;
      return (
        <view>
          <view main-thread:gesture={panGesture}></view>
        </view>
      );
    };

    await act(() => {
      const { container } = render(<App />, {
        enableMainThread: true,
        enableBackgroundThread: true,
      });
    });

    expect(spySetGesture).toHaveBeenCalled();

    const [viewElement, gestureId, gestureType, gestureConfig, relationConfig] =
      spySetGesture.mock.calls[0];

    // Assert view element properties (not the whole element)
    expect(viewElement.getAttribute('flatten')).toBe('false');
    expect(viewElement.getAttribute('has-react-gesture')).toBe('true');

    // Assert gesture ID is a number (don't care about specific value)
    expect(typeof gestureId).toBe('number');
    expect(gestureId).toBeGreaterThan(0);

    // Assert priority
    expect(gestureType).toBe(GestureTypeInner.PAN);

    // Assert gesture config
    expect(gestureConfig).toEqual({
      callbacks: [],
      config: {
        enabled: true,
        minDistance: 0,
      },
    });

    // Assert relation config
    expect(relationConfig).toEqual({
      continueWith: [],
      simultaneous: [],
      waitFor: [],
    });
  });

  test('bind gestures should call __SetGestureDetector with relationsConfig', async () => {
    let _panGesture;

    const App = () => {
      const panGesture = useGesture(PanGesture);

      _panGesture = panGesture;
      return (
        <view>
          <view main-thread:gesture={panGesture}></view>
        </view>
      );
    };

    await act(() => {
      const { container } = render(<App />, {
        enableMainThread: true,
        enableBackgroundThread: true,
      });
    });

    expect(spySetGesture).toHaveBeenCalled();

    const [viewElement, gestureId, gestureType, gestureConfig, relationConfig] =
      spySetGesture.mock.calls[0];

    // Assert view element properties (not the whole element)
    expect(viewElement.getAttribute('flatten')).toBe('false');
    expect(viewElement.getAttribute('has-react-gesture')).toBe('true');

    // Assert gesture ID is a number (don't care about specific value)
    expect(typeof gestureId).toBe('number');
    expect(gestureId).toBeGreaterThan(0);

    // Assert priority
    expect(gestureType).toBe(GestureTypeInner.PAN);

    // Assert gesture config
    expect(gestureConfig).toEqual({
      callbacks: [],
      config: {
        enabled: true,
        minDistance: 0,
      },
    });

    // Assert relation config
    expect(relationConfig).toEqual({
      continueWith: [],
      simultaneous: [],
      waitFor: [],
    });
  });
});

describe('test processGesture in MTS', () => {
  let spySetGesture: MockInstance;

  beforeEach(() => {
    spySetGesture = vi.spyOn(
      lynxTestingEnv.mainThread.globalThis,
      '__SetGestureDetector',
    );
  });

  afterEach(() => {
    spySetGesture.mockRestore();
  });

  test('Old ReactLynx would call __SetGestureDetector correctly', async () => {
    let _panGesture;

    const App = () => {
      const panGesture = useGesture(PanGesture);

      _panGesture = panGesture;
      return (
        <view>
          <view main-thread:gesture={panGesture}></view>
        </view>
      );
    };

    await act(() => {
      const { container } = render(<App />, {
        enableMainThread: true,
        enableBackgroundThread: true,
      });
    });

    expect(spySetGesture).toHaveBeenCalled();

    const [viewElement, gestureId, gestureType, gestureConfig, relationConfig] =
      spySetGesture.mock.calls[0];

    // Assert view element properties (not the whole element)
    expect(viewElement.getAttribute('flatten')).toBe('false');
    expect(viewElement.getAttribute('has-react-gesture')).toBe('true');

    // Assert gesture ID is a number (don't care about specific value)
    expect(typeof gestureId).toBe('number');
    expect(gestureId).toBeGreaterThan(0);

    // Assert priority
    expect(gestureType).toBe(GestureTypeInner.PAN);

    // Assert gesture config
    expect(gestureConfig).toEqual({
      callbacks: [],
      config: {
        enabled: true,
        minDistance: 0,
      },
    });

    // Assert relation config
    expect(relationConfig).toEqual({
      continueWith: [],
      simultaneous: [],
      waitFor: [],
    });
  });
});
