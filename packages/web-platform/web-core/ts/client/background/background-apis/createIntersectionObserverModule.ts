// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { Rpc } from '@lynx-js/web-worker-rpc';
import type {
  IntersectionObserverMargins,
  LynxIntersectionObserverCommand,
  LynxIntersectionObserverOptions,
} from '../../../types/index.js';
import { intersectionObserverCommandEndpoint } from '../../endpoints.js';

const DEFAULT_MARGINS: Required<IntersectionObserverMargins> = {
  left: 0,
  right: 0,
  top: 0,
  bottom: 0,
};

const DEFAULT_OPTIONS: Required<LynxIntersectionObserverOptions> = {
  thresholds: [0],
  initialRatio: 0,
  observeAll: false,
};

export function createIntersectionObserverModule(rpc: Rpc) {
  const sendCommand = rpc.createCall(intersectionObserverCommandEndpoint);
  const dispatch = (command: LynxIntersectionObserverCommand): void => {
    void sendCommand(command);
  };

  return {
    createIntersectionObserver(
      observerId: number,
      componentId: string,
      options?: LynxIntersectionObserverOptions,
    ): void {
      dispatch({
        type: 'create',
        observerId,
        componentId,
        options: {
          thresholds: options?.thresholds ?? DEFAULT_OPTIONS.thresholds,
          initialRatio: options?.initialRatio ?? DEFAULT_OPTIONS.initialRatio,
          observeAll: options?.observeAll ?? DEFAULT_OPTIONS.observeAll,
        },
      });
    },
    relativeTo(
      observerId: number,
      selector: string,
      margins?: IntersectionObserverMargins,
    ): void {
      dispatch({
        type: 'relativeTo',
        observerId,
        selector,
        margins: { ...DEFAULT_MARGINS, ...margins },
      });
    },
    relativeToViewport(
      observerId: number,
      margins?: IntersectionObserverMargins,
    ): void {
      dispatch({
        type: 'relativeToViewport',
        observerId,
        margins: { ...DEFAULT_MARGINS, ...margins },
      });
    },
    relativeToScreen(
      observerId: number,
      margins?: IntersectionObserverMargins,
    ): void {
      dispatch({
        type: 'relativeToScreen',
        observerId,
        margins: { ...DEFAULT_MARGINS, ...margins },
      });
    },
    observe(
      observerId: number,
      selector: string,
      callbackId: number,
    ): void {
      dispatch({
        type: 'observe',
        observerId,
        selector,
        callbackId,
      });
    },
    disconnect(observerId: number): void {
      dispatch({
        type: 'disconnect',
        observerId,
      });
    },
  };
}
