// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { JsFnHandle } from '@lynx-js/react/worklet-runtime/bindings';
import { WorkletEvents } from '@lynx-js/react/worklet-runtime/bindings';

import { enableRunOnBackground } from './functionality.js';

/**
 * @internal
 */
interface RunOnBackgroundData {
  obj: JsFnHandle;
  params: unknown[];
}

/**
 * `runOnBackground` allows triggering js functions on the js context asynchronously.
 * @param f - The js function to be called.
 * @returns A function. Calling which with the arguments to be passed to the js function to trigger it on the js context.
 * @public
 */
function runOnBackground<Fn extends (...args: any[]) => any>(f: Fn): (...args: Parameters<Fn>) => void {
  if (!enableRunOnBackground()) {
    throw new Error('runOnBackground requires Lynx sdk version 2.16.');
  }
  if (__JS__) {
    throw new Error('runOnBackground can not be used on the main thread.');
  }
  const obj = f as any as JsFnHandle;
  if (obj._error) {
    throw new Error(obj._error);
  }
  return (...params: any[]): void => {
    if (lynx.getJSContext) {
      lynx.getJSContext().dispatchEvent({
        type: WorkletEvents.runOnBackground,
        data: JSON.stringify({
          obj: {
            _jsFnId: obj._jsFnId,
            _execId: obj._execId!,
          },
          params,
        }),
      });
    }
  };
}

export { type RunOnBackgroundData, runOnBackground };
