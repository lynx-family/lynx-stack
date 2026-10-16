// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import fs from 'node:fs';
import path from 'node:path';

import type { RsbuildPlugin, TransformContext } from '@rsbuild/core';

import { transformMarked } from './transform.js';

export function transformMarkedModule(
  { code, resourcePath, addDependency }: Pick<
    TransformContext,
    'code' | 'resourcePath' | 'addDependency'
  >,
) {
  const manifest = path.resolve(path.dirname(resourcePath), '../package.json');
  addDependency(manifest);
  const { name, version } = JSON.parse(fs.readFileSync(manifest, 'utf8')) as {
    name: string;
    version: string;
  };
  if (name !== 'marked') {
    throw new Error(
      `Marked Unicode transform received an unexpected package: ${name}`,
    );
  }
  const result = transformMarked(code, version, resourcePath);
  return { code: result.code, map: result.map.toString() };
}

export function pluginMarkedUnicode(): RsbuildPlugin {
  return {
    name: 'genui:marked-unicode',
    setup(api) {
      api.transform({
        test: /[\\/]marked[\\/]lib[\\/]marked\.esm\.js$/,
        // Run before SWC, which separately transforms regex literals.
        order: 'pre',
      }, transformMarkedModule);
    },
  };
}
