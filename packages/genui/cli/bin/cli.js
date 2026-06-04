#!/usr/bin/env node
// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import * as path from 'node:path';

import { runCli } from '../dist/cli.js';

try {
  process.exitCode = await runCli(process.argv.slice(2), process.cwd(), {
    binName: path.basename(process.argv[1] ?? 'genui'),
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
