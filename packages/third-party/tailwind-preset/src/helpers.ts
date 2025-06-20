// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import _createUtilityPlugin from 'tailwindcss/lib/util/createUtilityPlugin.js';

import type { PluginCreator } from './types/tailwind-types.js';

function createPlugin(fn: PluginCreator): PluginCreator {
  return fn;
}

type PropertyEntry =
  | string
  | [string, string]
  | [string, [string, string]];

export type UtilityEntry = [string, PropertyEntry[]];

export type UtilityVariation =
  | UtilityEntry
  | UtilityEntry[];

interface UtilityPluginOptions {
  type?: string[];
  supportsNegativeValues?: boolean;
  filterDefault?: boolean;
}

/**
 * A type-safe re-export of Tailwind's internal createUtilityPlugin.
 * For internal use in Lynx plugin system.
 */
function createUtilityPlugin(
  themeKey: string,
  utilityVariations?: UtilityVariation[] | UtilityVariation,
  options?: UtilityPluginOptions,
): PluginCreator {
  return _createUtilityPlugin(themeKey, utilityVariations, options);
}

export { createUtilityPlugin, createPlugin };
