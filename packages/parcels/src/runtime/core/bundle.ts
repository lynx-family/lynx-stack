// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { ParcelSource } from './types.js';

export function resolveParcelBundle(source: ParcelSource): Promise<string> {
  // Native Lynx uses __Card__ for the current bundle and the resolved URL for
  // external bundles. fetchBundle has a callback-style then, not a Promise.
  if (source.kind === 'embedded') return Promise.resolve('__Card__');
  return new Promise((resolve, reject) => {
    lynx.fetchBundle(source.url, {}).then(response => {
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
