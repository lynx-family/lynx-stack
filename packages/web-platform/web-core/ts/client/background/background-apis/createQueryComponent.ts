// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { NativeApp } from '../../../types/index.js';

type QueryComponentResult = Parameters<
  Parameters<NativeApp['queryComponent']>[1]
>[0];

export function createQueryComponent(
  query: (source: string) => Promise<QueryComponentResult>,
): NativeApp['queryComponent'] {
  const pending = new Map<string, Promise<QueryComponentResult>>();

  return (source, callback) => {
    const queryFailure = {
      code: -1,
      detail: { schema: source },
    };
    const existing = pending.get(source);
    if (existing) {
      void existing.then(callback, () => callback(queryFailure));
      return;
    }

    const request = query(source);
    pending.set(source, request);
    const complete = (result: QueryComponentResult) => {
      if (pending.get(source) === request) {
        pending.delete(source);
      }
      callback(result);
    };
    void request.then(complete, () => complete(queryFailure));
  };
}
