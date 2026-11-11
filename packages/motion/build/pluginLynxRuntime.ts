// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { rspack } from '@rslib/core';
import type { RsbuildPlugin } from '@rslib/core';

import { lynxRuntimePreset } from './lynxRuntimePreset.js';

/** Import the private Lynx host APIs referenced by the bundled library. */
export function pluginLynxRuntime(): RsbuildPlugin {
  return {
    name: 'lynx:private-runtime',
    setup(api) {
      api.modifyRspackConfig((config) => {
        const provides: Record<string, string[]> = {};
        const types: Record<string, string> = {};
        const replacements: Record<string, string> = {};
        for (const [module, globals] of Object.entries(lynxRuntimePreset)) {
          const runtime = `lynx-private-runtime/${module}`;
          replacements[runtime] = `../polyfill/${module}.js`;
          for (const [name, type] of Object.entries(globals)) {
            for (const reference of [name, `globalThis.${name}`]) {
              provides[reference] = [runtime, name];
              // typeof guards describe the private API, not the host global.
              types[`typeof ${reference}`] = JSON.stringify(type);
            }
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
        config.externals = [...externals, replacements];
      });
    },
  };
}
