// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import _createUtilityPlugin from 'tailwindcss/lib/util/createUtilityPlugin.js';

import type {
  UtilityPluginOptions,
  UtilityVariations,
} from './types/plugin-types.js';
import type { PluginCreator } from './types/tailwind-types.js';

function createPlugin(fn: PluginCreator): PluginCreator {
  return fn;
}

/**
 * A type-safe re-export of Tailwind's internal createUtilityPlugin.
 * For internal use in Lynx plugin system.
 */
function createUtilityPlugin(
  themeKey: string,
  utilityVariations?: UtilityVariations,
  options?: UtilityPluginOptions,
): PluginCreator {
  return _createUtilityPlugin(themeKey, utilityVariations as unknown, options);
}

export { createUtilityPlugin, createPlugin };
