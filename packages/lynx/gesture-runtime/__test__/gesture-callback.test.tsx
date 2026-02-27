// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { MockInstance } from 'vitest';

import { useRef } from '@lynx-js/react';
import { act, render } from '@lynx-js/react/testing-library';

import { PanGesture } from '../src/index.js';
import { useGesture } from '../src/useGesture.js';
import {
  MockGestureManager,
  genEventObj,
  triggerGestureCallback,
} from './utils/callback.js';

describe('gestures mt', () => {
  let spySetGesture: MockInstance;
  let _gestureNode: any;

  beforeEach(() => {
    spySetGesture = vi.spyOn(
      lynxTestingEnv.mainThread.globalThis,
      '__SetGestureDetector',
    ).mockImplementation(function(
      node: any,
      id: number,
      type: number,
      config: any,
      relationMap: Record<string, number[]>,
    ) {
      node.gesture = {
        id,
        type,
        config,
        relationMap,
      };

      _gestureNode = node;
    });
  });

  afterEach(() => {
    spySetGesture.mockRestore();
    _gestureNode = null;
  });

  test('bind gestures should call papi correctly', async () => {
    let _panGesture;
    const mockGestureManager = new MockGestureManager();

    const App = () => {
      const panGesture = useGesture(PanGesture);
      panGesture.onBegin((event, stateManager) => {
        'main thread';
        globalThis._eventObj = event;
      });

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

    await act(() => {
      const eventObj = genEventObj(_gestureNode, {
        params: { x: 0, y: 1 },
      });

      triggerGestureCallback(
        _gestureNode,
        'onBegin',
        eventObj,
        mockGestureManager,
      );
    });

    expect(globalThis._eventObj.params.x).toBe(0);
    expect(globalThis._eventObj.params.y).toBe(1);

    delete globalThis._eventObj;
  });

  test('stateManager.active should call __SetGestureDetector correctly', async () => {
    let _panGesture;
    const mockGestureManager = new MockGestureManager();

    const App = () => {
      const panGesture = useGesture(PanGesture);
      panGesture.onBegin((event, stateManager) => {
        'main thread';
        stateManager.active();
      });

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

    await act(() => {
      const eventObj = genEventObj(_gestureNode, {
        params: { x: 0, y: 1 },
      });

      triggerGestureCallback(
        _gestureNode,
        'onBegin',
        eventObj,
        mockGestureManager,
      );
    });

    expect(mockGestureManager.__SetGestureState).toBeCalledWith(
      _gestureNode,
      _gestureNode.gesture.id,
      1,
    );
  });

  test('stateManager.fail should call __SetGestureDetector correctly', async () => {
    let _panGesture;
    const mockGestureManager = new MockGestureManager();

    const App = () => {
      const panGesture = useGesture(PanGesture);
      panGesture.onBegin((event, stateManager) => {
        'main thread';
        stateManager.fail();
      });

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

    await act(() => {
      const eventObj = genEventObj(_gestureNode, {
        params: { x: 0, y: 1 },
      });

      triggerGestureCallback(
        _gestureNode,
        'onBegin',
        eventObj,
        mockGestureManager,
      );
    });

    expect(mockGestureManager.__SetGestureState).toBeCalledWith(
      _gestureNode,
      _gestureNode.gesture.id,
      2,
    );
  });

  test('stateManager.end should call __SetGestureDetector correctly', async () => {
    let _panGesture;
    const mockGestureManager = new MockGestureManager();

    const App = () => {
      const panGesture = useGesture(PanGesture);
      panGesture.onBegin((event, stateManager) => {
        'main thread';
        stateManager.end();
      });

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

    await act(() => {
      const eventObj = genEventObj(_gestureNode, {
        params: { x: 0, y: 1 },
      });

      triggerGestureCallback(
        _gestureNode,
        'onBegin',
        eventObj,
        mockGestureManager,
      );
    });

    expect(mockGestureManager.__SetGestureState).toBeCalledWith(
      _gestureNode,
      _gestureNode.gesture.id,
      3,
    );
  });

  test('stateManager.consumeGesture should call __ConsumeGesture correctly', async () => {
    let _panGesture;
    const mockGestureManager = new MockGestureManager();

    const App = () => {
      const panGesture = useGesture(PanGesture);
      panGesture.onBegin((event, stateManager) => {
        'main thread';
        stateManager.consumeGesture(true);
      });

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

    await act(() => {
      const eventObj = genEventObj(_gestureNode, {
        params: { x: 0, y: 1 },
      });

      triggerGestureCallback(
        _gestureNode,
        'onBegin',
        eventObj,
        mockGestureManager,
      );
    });

    expect(mockGestureManager.__ConsumeGesture).toBeCalledWith(
      _gestureNode,
      _gestureNode.gesture.id,
      { consume: true, inner: true },
    );
  });

  test('stateManager.interceptGesture should call __ConsumeGesture correctly', async () => {
    let _panGesture;
    const mockGestureManager = new MockGestureManager();

    const App = () => {
      const panGesture = useGesture(PanGesture);
      panGesture.onBegin((event, stateManager) => {
        'main thread';
        stateManager.interceptGesture(true);
      });

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

    await act(() => {
      const eventObj = genEventObj(_gestureNode, {
        params: { x: 0, y: 1 },
      });

      triggerGestureCallback(
        _gestureNode,
        'onBegin',
        eventObj,
        mockGestureManager,
      );
    });

    expect(mockGestureManager.__ConsumeGesture).toBeCalledWith(
      _gestureNode,
      _gestureNode.gesture.id,
      { consume: true, inner: false },
    );
  });
});
