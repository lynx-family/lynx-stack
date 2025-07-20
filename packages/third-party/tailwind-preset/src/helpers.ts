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
 * Returns a shallow clone of the object where all function values
 * are bound with `this` set to `undefined`,
 * so that destructuring is safe and ESLint `unbound-method` rule won't trigger.
 *
 * This is only safe for objects whose function values are `this`-independent
 *
 * E.g. Use this when passing a `PluginAPI` to a plugin handler to ensure functions like
 * `theme()` or `matchUtilities()` can be safely destructured and called.
 */
function autoBind<T extends object>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) =>
      isFunction(v) ? [k, v.bind(undefined)] : [k, v]
    ),
  ) as T;
}

function isFunction(value: unknown): value is (...args: unknown[]) => unknown {
  return typeof value === 'function';
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

export { createUtilityPlugin, createPlugin, createPluginWithName, autoBind };
export type { Plugin };

/* ──────────────── 100 % typed exports for transform/shadow utils ─────────── */

export const transformThemeValue: (key: ThemeKey) => ValueTransformer =
  _transformThemeValue;
export { parseBoxShadowValue, formatBoxShadowValue };
export type { ShadowPart };
