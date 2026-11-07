// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import fs from 'node:fs';
import path from 'node:path';

import type { RsbuildPlugin, TransformContext } from '@rsbuild/core';

import { transformMarked } from './transform.js';

/**
 * Transform a Marked module and track its package manifest for rebuilds.
 *
 * @param context - Module source, resource path, and dependency registration.
 * @returns Transformed source with a serialized source map.
 * @throws If the package is not Marked or its version or source is unsupported.
 */
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

/** Register the Marked Unicode transform before SWC for Web and native builds. */
export function pluginMarkedUnicode(): RsbuildPlugin {
  return {
    name: 'genui:marked-unicode',
    /** Apply the transform only to Marked's ESM entry. */
    setup(api) {
      api.transform({
        test: /[\\/]marked[\\/]lib[\\/]marked\.esm\.js$/,
        // Run before SWC, which separately transforms regex literals.
        order: 'pre',
      }, transformMarkedModule);
    },
  };
}
