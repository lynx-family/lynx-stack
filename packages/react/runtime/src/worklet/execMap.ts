// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { JsFnHandle, Worklet } from '@lynx-js/react/worklet-runtime/bindings';

import { IndexMap } from './indexMap.js';

/**
 * `WorkletExecIdMap` ensures the worklet object is not released in js context when the main thread is still holding the
 * worklet object (or any of its jsFnHandles). The worklet object holds the js functions which might be called by `runOnBackground()`.
 * If the worklet object is incorrectly released earlier, the `runOnBackground()` would result in failure.
 *
 * Every time a worklet object is sent to the main thread, an `execId` is distributed and will be sent to element
 * context with the worklet object. This relationship is recorded in this class. When all the references to the
 * worklet object are released in the main thread, a message will be sent back to remove the record here.
 *
 * @internal
 */
export class WorkletExecIdMap extends IndexMap<Worklet> {
  public override add(worklet: Worklet): number {
    const execId = super.add(worklet);
    worklet._execId = execId;
    return execId;
  }

  public findJsFnHandle(execId: number, fnId: number): JsFnHandle | undefined {
    const worklet = this.get(execId);
    if (!worklet) {
      return undefined;
    }

    const f = (value: unknown): JsFnHandle | undefined => {
      if (value === null || typeof value !== 'object') {
        return undefined;
      }
      const obj = value as Record<string, unknown>;
      if ('_jsFnId' in obj && obj['_jsFnId'] === fnId) {
        return obj as JsFnHandle;
      }
      for (const i in obj) {
        const result = f(obj[i]);
        if (result) {
          return result;
        }
      }
      return undefined;
    };

    return f(worklet);
  }
}
