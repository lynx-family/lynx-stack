// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// `node:querystring` has no browser equivalent: every member throws on use.
// The named exports are the keys of the Node.js 24 module.

import { trap } from './trap.js';

const querystring = trap<typeof import('node:querystring')>('node:querystring');

export const {
  unescapeBuffer,
  unescape,
  escape,
  stringify,
  encode,
  parse,
  decode,
} = querystring;
export default querystring;
