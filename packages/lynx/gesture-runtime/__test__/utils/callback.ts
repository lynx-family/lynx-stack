// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { vi } from 'vitest';
import type { Mock } from 'vitest';

import type {
  ConsumeGestureParams,
  SetGestureStateType,
} from '../../src/gestureInterface.js';

interface ProcessesGestureConfig {
  callbacks: {
    name: string;
    callback: Worklet;
  }[];
  config?: Record<string, unknown>;
}

export class MockGestureManager {
  __SetGestureState: Mock<
    (dom: any, id: number, type: SetGestureStateType) => void
  > = vi.fn((dom: any, id: number, type: SetGestureStateType) => {});
  __ConsumeGesture: Mock<
    (dom: any, id: number, params: ConsumeGestureParams) => void
  > = vi.fn((dom: any, id: number, params: ConsumeGestureParams) => {});
}

function getCallback(config: ProcessesGestureConfig, method: string) {
  if (config.callbacks) {
    return config.callbacks.find((callback) => callback.name === method);
  } else {
    return undefined;
  }
}

export function triggerGestureCallback(
  node: any,
  method: string,
  event: any,
  manager: MockGestureManager,
): void {
  const callbackObj = getCallback(node?.gesture?.config, method);
  if (callbackObj) {
    globalThis.runWorklet(callbackObj.callback, [
      event,
      manager,
    ]);
  } else {
    throw new Error(`No gesture callback for ${method}`);
  }
}

export function genEventObj(target: any, body: Record<string, unknown>): {
  target: {
    elementRefptr: any;
  };
  currentTarget: {
    elementRefptr: any;
  };
} {
  return {
    target: {
      elementRefptr: target,
    },
    currentTarget: {
      elementRefptr: target,
    },
    ...body,
  };
}
