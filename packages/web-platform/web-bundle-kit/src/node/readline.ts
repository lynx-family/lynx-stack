// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// `node:readline` has no browser equivalent: every member throws on use.
// The named exports are the keys of the Node.js 24 module.

import { trap } from './trap.js';

const readline = trap<typeof import('node:readline')>('node:readline');

export const {
  Interface,
  clearLine,
  clearScreenDown,
  createInterface,
  cursorTo,
  emitKeypressEvents,
  moveCursor,
  promises,
} = readline;
export default readline;
