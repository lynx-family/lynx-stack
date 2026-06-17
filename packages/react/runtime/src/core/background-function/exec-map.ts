// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { IndexMap } from '../../shared/index-map.js';
import type { JsFnHandle, Worklet } from '../../worklet-runtime/bindings/types.js';

/**
 * Keeps the background-thread worklet ctx alive while main thread still holds
 * a handle to one of its background functions.
 */
export class BackgroundFunctionExecMap extends IndexMap<Worklet> {
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

    return this.findJsFnHandleInValue(worklet, fnId);
  }

  private findJsFnHandleInValue(value: unknown, fnId: number): JsFnHandle | undefined {
    if (value === null || typeof value !== 'object') {
      return undefined;
    }
    const obj = value as Record<string, unknown>;
    if ('_jsFnId' in obj && obj['_jsFnId'] === fnId) {
      return obj as JsFnHandle;
    }
    for (const i in obj) {
      const result = this.findJsFnHandleInValue(obj[i], fnId);
      if (result) {
        return result;
      }
    }
    return undefined;
  }
}
