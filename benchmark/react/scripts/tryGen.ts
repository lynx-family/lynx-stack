// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/* eslint-disable n/file-extension-in-import */

import { readFileSync } from 'node:fs';

import { gen } from '../plugins/gen.ts';

console.log(
  readFileSync(0).toString().replace(
    /__GENERATE_JSX__\((\d+), ?(\d+)\)/g,
    (_, $1: string, $2: string) => {
      return gen(parseInt($1, 10), parseInt($2, 10));
    },
  ),
);
