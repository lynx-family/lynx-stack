// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { IslandReference } from './types.js';

export function resolveIslandEntry(
  reference: IslandReference,
): Promise<string> {
  // Native Lynx uses __Card__ for the current bundle and the resolved URL for
  // remote bundles. fetchBundle has a callback-style then, not a Promise.
  if (reference.entry === undefined) return Promise.resolve('__Card__');
  return new Promise((resolve, reject) => {
    if (!/^[a-z][a-z\d+.-]*:\/\//i.test(reference.entry!)) {
      reject(new Error('Island entry must be an absolute bundle URL'));
      return;
    }
    lynx.fetchBundle(reference.entry!, {}).then(response => {
      if (response.code === 0) {
        resolve(response.url);
      } else {
        const message = response.error_msg
          || (response as { errorMsg?: string }).errorMsg;
        reject(new Error(message ?? `fetchBundle returned ${response.code}`));
      }
    });
  });
}
