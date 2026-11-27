// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// `node:child_process` has no browser equivalent: every member throws on use.
// The named exports are the keys of the Node.js 24 module.

import { trap } from './trap.js';

const childProcess = trap<typeof import('node:child_process')>(
  'node:child_process',
);

export const {
  _forkChild,
  ChildProcess,
  exec,
  execFile,
  execFileSync,
  execSync,
  fork,
  spawn,
  spawnSync,
} = childProcess;
export default childProcess;
