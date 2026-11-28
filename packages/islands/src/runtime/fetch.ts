// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/** Fetch a native bundle asynchronously and retain its resolved resource identity. */
export function fetchIslandBundle(entry: string): Promise<string> {
  // Lynx has no browser URL constructor on every runtime. Let the host resolve
  // absolute resource schemes, but reject paths that depend on a browser base URL.
  if (!/^[a-z][a-z\d+.-]*:\/\/\S+$/i.test(entry)) {
    return Promise.reject(
      new Error('Island entry must be an absolute bundle URL'),
    );
  }
  return new Promise((resolve, reject) => {
    // ResponseHandler.then is callback-only and returns void.
    lynx.fetchBundle(entry, {}).then(info => {
      if (info.code !== 0) {
        reject(
          new Error(
            `Failed to fetch island bundle ${entry}: ${info.error_msg} (${info.code})`,
          ),
        );
      } else if (info.url) {
        resolve(info.url);
      } else {
        reject(new Error(`Island bundle has no resolved URL: ${entry}`));
      }
    });
  });
}
