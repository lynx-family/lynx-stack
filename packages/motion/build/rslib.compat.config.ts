// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { isAbsolute, join } from 'node:path';

import { defineConfig } from '@rslib/core';
import type { RslibConfig } from '@rslib/core';

import config from '../rslib.config.js';

// Opt-in dependency-upgrade probe. Never change the production version pins or
// overwrite dist while testing another upstream dependency graph.
const directory = process.env['MOTION_COMPAT_ROOT'];
if (!directory || !isAbsolute(directory)) {
  throw new Error(
    'MOTION_COMPAT_ROOT must be an absolute directory with installed upstream packages',
  );
}
const packages = ['motion', 'motion-dom', 'motion-utils', 'framer-motion'];
if (!config.lib) throw new Error('The Motion build must define its libraries');

const compatibilityConfig: RslibConfig = defineConfig({
  ...config,
  lib: config.lib.map(lib => ({
    ...lib,
    ...(lib.id === 'upstream'
      ? {
        resolve: {
          alias: Object.fromEntries(
            packages.map(name => [name, join(directory, 'node_modules', name)]),
          ),
        },
      }
      : {}),
    output: {
      ...lib.output,
      cleanDistPath: true,
      distPath: { root: join(directory, 'dist') },
    },
  })),
});

export default compatibilityConfig;
