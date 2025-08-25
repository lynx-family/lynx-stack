// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';

mkdirSync('./dist/bin', { recursive: true });
if (process.platform === 'win32') {
  writeFileSync(
    './dist/bin/benchx_cli',
    `\
#!/usr/bin/env node

console.log('noop')
`,
  );
} else {
  copyFileSync('/usr/bin/true', './dist/bin/benchx_cli');
}
