// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { rspack } from '@rslib/core';
import type { RsbuildPlugin } from '@rslib/core';

const runtimeGlobals = {
  document: 'object',
  window: 'object',
  Element: 'function',
  HTMLElement: 'function',
  SVGElement: 'function',
  NodeList: 'function',
  EventTarget: 'function',
  getComputedStyle: 'function',
  performance: 'object',
  queueMicrotask: 'function',
};

/** Compile Motion's browser globals into imports of the private Lynx runtime. */
export function pluginMotionRuntime(): RsbuildPlugin {
  return {
    name: 'lynx:motion-runtime',
    setup(api) {
      api.modifyRspackConfig((config) => {
        const provides: Record<string, string[]> = {};
        const types: Record<string, string> = {};
        for (const [name, type] of Object.entries(runtimeGlobals)) {
          const runtime = name === 'queueMicrotask'
            ? 'lynx-motion-microtask'
            : 'lynx-motion-runtime';
          for (const reference of [name, `globalThis.${name}`]) {
            provides[reference] = [runtime, name];
            // ProvidePlugin handles value references; typeof guards must also
            // describe the private API when the host global is absent.
            types[`typeof ${reference}`] = JSON.stringify(type);
          }
        }
        config.plugins ??= [];
        config.plugins.push(
          new rspack.ProvidePlugin(provides),
          new rspack.DefinePlugin(types),
        );
        // Keep one ElementCompt constructor for both the adapter and vendor code.
        const externals = config.externals
          ? (Array.isArray(config.externals)
            ? config.externals
            : [config.externals])
          : [];
        config.externals = [...externals, {
          'lynx-motion-runtime': '../polyfill/runtime.js',
          'lynx-motion-microtask': '../polyfill/microtask.js',
        }];
      });
    },
  };
}
