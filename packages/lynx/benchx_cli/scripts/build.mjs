// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Windows: Create noop binary
if (process.platform === 'win32') {
  const binDir = join(__dirname, '..', 'dist', 'bin');
  mkdirSync(binDir, { recursive: true });
  writeFileSync(
    join(binDir, 'benchx_cli'),
    '#!/usr/bin/env node\n\nconsole.log(\'noop\')\n',
  );
  // eslint-disable-next-line n/no-process-exit
  process.exit(0);
}

// Unix: Run build_unix.sh
const result = spawnSync('bash', [join(__dirname, 'build_unix.sh')], {
  stdio: 'inherit',
});

if (result.error) {
  console.error('Failed to execute script "build_unix.sh":', result.error);
  // eslint-disable-next-line n/no-process-exit
  process.exit(1);
}

// eslint-disable-next-line n/no-process-exit
process.exit(result.status ?? 1);
