// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import _createUtilityPlugin from 'tailwindcss/lib/util/createUtilityPlugin.js';
import {
  formatBoxShadowValue,
  parseBoxShadowValue,
} from 'tailwindcss/lib/util/parseBoxShadowValue.js';
import type { ShadowPart } from 'tailwindcss/lib/util/parseBoxShadowValue.js';
import _transformThemeValue from 'tailwindcss/lib/util/transformThemeValue.js';

import type {
  UtilityPluginOptions,
  UtilityVariations,
} from './types/plugin-types.js';
import type { PluginAPI, PluginCreator } from './types/tailwind-types.js';

/* ───────────────────────── createPlugin / autoBind ───────────────────────── */

/**
 * Wraps a Tailwind PluginCreator and auto-binds all function properties of the API.
 */
function createPlugin(
  fn: (api: Bound<PluginAPI>) => void,
): PluginCreator {
  return (api) => {
    const bound = autoBind(api);
    fn(bound);
  };
}

/**
 * Type helper: binds all function-valued properties in T.
 */
type Bound<T> = {
  [K in keyof T]: T[K] extends (...args: infer A) => infer R
    ? (this: void, ...args: A) => R
    : T[K];
};

/**
 * Auto-binds all function-valued properties to the original object.
 */
function autoBind<T extends object>(obj: T): Bound<T> {
  const result = {} as Bound<T>;

  for (const key of Object.keys(obj) as Array<keyof T>) {
    const value = obj[key];

    result[key] = (typeof value === 'function'
      ? (value.bind(obj) as Bound<T>[typeof key])
      : value) as Bound<T>[typeof key];
  }

  return result;
}

/* ─────────────────────── re-export Tailwind utility helper ───────────────── */

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

/* ──────────────── 100 % typed exports for transform/shadow utils ─────────── */

export const transformThemeValue = _transformThemeValue;
export { parseBoxShadowValue, formatBoxShadowValue };
export type { ShadowPart };
