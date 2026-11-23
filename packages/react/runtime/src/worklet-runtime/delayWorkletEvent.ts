// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { ClosureValueType, Worklet } from './bindings/types.js';
import { profile } from './utils/profile.js';

interface EventDelayImpl {
  _delayedWorkletParamsMap: Map<string, ClosureValueType[][]>;
  delayExecUntilJsReady(hash: string, params: ClosureValueType[]): void;
  runDelayedWorklet(worklet: Worklet, element: ElementNode): void;
  clearDelayedWorklets(): void;
}

function initEventDelay(): EventDelayImpl {
  const instance: EventDelayImpl = {
    _delayedWorkletParamsMap: new Map(),
    delayExecUntilJsReady(
      hash: string,
      params: ClosureValueType[],
    ): void {
      profile('delayExecUntilJsReady: ' + hash, () => {
        const map = instance._delayedWorkletParamsMap;
        const paramVec = map.get(hash);
        if (paramVec) {
          paramVec.push(params);
        } else {
          map.set(hash, [params]);
        }
      });
    },
    runDelayedWorklet(worklet: Worklet, element: ElementNode): void {
      profile('commitDelayedWorklet', () => {
        const paramsVec = instance._delayedWorkletParamsMap.get(
          worklet._wkltId,
        );
        if (paramsVec === undefined) {
          return;
        }
        const leftParamsVec: ClosureValueType[][] = [];
        paramsVec.forEach((params) => {
          const firstParam = params[0] as { currentTarget?: { elementRefptr?: ElementNode } } | undefined;
          if (firstParam?.currentTarget?.elementRefptr === element) {
            setTimeout(() => {
              profile('runDelayedWorklet', () => {
                runWorklet(worklet, params);
              });
            }, 0);
          } else {
            leftParamsVec.push(params);
          }
        });
        instance._delayedWorkletParamsMap.set(
          worklet._wkltId,
          leftParamsVec,
        );
      });
    },
    clearDelayedWorklets(): void {
      instance._delayedWorkletParamsMap.clear();
    },
  };
  return instance;
}

export { type EventDelayImpl, initEventDelay };
