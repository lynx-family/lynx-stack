// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// `node:child_process` has no browser equivalent. Bundled code imports these
// members, and calls `promisify(execFile)` when a module loads, so they are
// functions; calling one throws.

function unsupported(name: string): () => never {
  return () => {
    const error = new Error(
      `node:child_process.${name}() is not available in @lynx-js/web-bundle-kit (a browser build)`,
    );
    throw Object.assign(error, { code: 'ERR_WEB_BUNDLE_KIT_UNSUPPORTED' });
  };
}

const childProcess = {
  execFile: unsupported('execFile'),
  execFileSync: unsupported('execFileSync'),
  spawn: unsupported('spawn'),
};

export const { execFile, execFileSync, spawn } = childProcess;
export default childProcess;
