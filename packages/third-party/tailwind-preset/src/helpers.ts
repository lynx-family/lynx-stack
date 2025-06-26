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
  ThemeKey,
  ValueTransformer,
} from 'tailwindcss/lib/util/transformThemeValue.js';

import type {
  Bound,
  BoundedPluginCreator,
  OptionsFn,
  PluginFn,
  UtilityPluginOptions,
  UtilityVariations,
} from './types/plugin-types.js';
import type {
  Config,
  Plugin,
  PluginAPI,
  PluginCreator,
} from './types/tailwind-types.js';

/* ───────────────────────── createPlugin / autoBind ───────────────────────── */

/**
 * Wraps a Tailwind PluginCreator and auto-binds all function properties of the API.
 */
function createPlugin(
  fn: BoundedPluginCreator,
  cfg?: Partial<Config>,
): { handler: PluginCreator; config?: Partial<Config> | undefined } {
  return {
    handler: (api: PluginAPI) => fn(autoBind(api)),
    config: cfg,
  };
}

function isCorePluginDisabled(api: PluginAPI, key: string): boolean {
  return api.config<boolean>(`corePlugins.${key}`) === false;
}

function createPluginWithName(
  name: string,
  fn: BoundedPluginCreator,
  cfg?: Partial<Config>,
): { handler: PluginCreator; config?: Partial<Config> | undefined } {
  return {
    handler: (api: PluginAPI) => {
      if (isCorePluginDisabled(api, name)) return;
      fn(autoBind(api));
    },
    config: { ...cfg, name },
  };
}

function basePlugin(
  pluginFn: PluginCreator,
  cfg?: Partial<Config>,
): { handler: PluginCreator; config?: Partial<Config> | undefined } {
  return { handler: pluginFn, config: cfg };
}

function pluginImpl(
  pluginFn: BoundedPluginCreator,
  cfg?: Partial<Config>,
): { handler: PluginCreator; config?: Partial<Config> | undefined } {
  const wrapped: PluginCreator = (api: PluginAPI) => pluginFn(autoBind(api));
  return basePlugin(wrapped, cfg);
}

function withOptions<T>(
  factory: (options: T) => BoundedPluginCreator,
  cfgFactory?: (options: T) => Partial<Config>,
): OptionsFn<T> {
  const optionsFn: OptionsFn<T> = ((options: T) =>
    basePlugin(
      (api: PluginAPI) => factory(options)(autoBind(api)),
      cfgFactory?.(options),
    )) as OptionsFn<T>;

  optionsFn.__isOptionsFunction = true as const;
  return optionsFn;
}

pluginImpl.withOptions = withOptions;

export const plugin: PluginFn = pluginImpl;

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

export { createUtilityPlugin, createPlugin, createPluginWithName };
export type { Plugin };

/* ──────────────── 100 % typed exports for transform/shadow utils ─────────── */

export const transformThemeValue: (key: ThemeKey) => ValueTransformer =
  _transformThemeValue;
export { parseBoxShadowValue, formatBoxShadowValue };
export type { ShadowPart };
