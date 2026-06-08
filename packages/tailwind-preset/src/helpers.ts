// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { createRequire } from 'node:module';

import type {
  Bound,
  BoundedPluginCreator,
  CreatePluginFunction,
  PluginWithConfig,
  PluginWithOptions,
  UtilityPluginOptions,
  UtilityVariations,
} from './types/plugin-types.js';
import type {
  Config,
  Plugin,
  PluginAPI,
  PluginCreator,
} from './types/tailwind-types.js';

/* ──────────────── types for tailwindcss internals ─────────── */

export interface ShadowPart {
  raw: string;
  keyword?: string;
  x?: string;
  y?: string;
  blur?: string;
  spread?: string;
  color?: string;
  unknown?: string[];
  valid: boolean;
}

type FontKeys = 'fontSize' | 'fontFamily' | 'outline';
type TransformKeys =
  | 'boxShadow'
  | 'transitionProperty'
  | 'transitionDuration'
  | 'transitionDelay'
  | 'transitionTimingFunction'
  | 'backgroundImage'
  | 'backgroundSize'
  | 'backgroundColor'
  | 'cursor'
  | 'animation'
  | 'gridTemplateColumns'
  | 'gridTemplateRows'
  | 'objectPosition'
  | string & {};

export type ThemeKey = FontKeys | TransformKeys;

export type ValueTransformer<T = unknown> = (
  value: T,
  opts?: Record<string, unknown>,
) => string | number | string[] | undefined;

// Use createRequire to load tailwindcss CJS internals.
// tailwindcss's CJS output uses swc's _export() helper pattern which
// Node.js cjs-module-lexer cannot statically analyze, making ESM named
// imports fail at runtime. createRequire bypasses this entirely by using
// Node.js's CJS loader directly, working in both ESM and CJS output.
const require = createRequire(import.meta.url);

const _setupContextUtils = require(
  'tailwindcss/lib/lib/setupContextUtils.js',
) as { INTERNAL_FEATURES: symbol };
const _createUtilityPlugin = require(
  'tailwindcss/lib/util/createUtilityPlugin.js',
) as { default: (themeKey: string, v?: unknown, o?: unknown) => PluginCreator };
const _parseBoxShadowValue = require(
  'tailwindcss/lib/util/parseBoxShadowValue.js',
) as {
  parseBoxShadowValue: (input: string) => ShadowPart[];
  formatBoxShadowValue: (shadows: ShadowPart[]) => string;
};
const _transformThemeValue = require(
  'tailwindcss/lib/util/transformThemeValue.js',
) as { default: (key: ThemeKey) => ValueTransformer };

const INTERNAL_FEATURES = _setupContextUtils.INTERNAL_FEATURES;
const parseBoxShadowValue: (input: string) => ShadowPart[] =
  _parseBoxShadowValue.parseBoxShadowValue;
const formatBoxShadowValue: (shadows: ShadowPart[]) => string =
  _parseBoxShadowValue.formatBoxShadowValue;

/* ───────────────────────── createPlugin / autoBind ───────────────────────── */

/**
 * Wraps a Tailwind PluginCreator and auto-binds all function properties of the API.
 */
function createPluginImpl(
  fn: BoundedPluginCreator,
  cfg?: Partial<Config>,
): PluginWithConfig {
  return {
    handler: (api: PluginAPI) => fn(autoBind(api)),
    config: cfg,
  };
}

createPluginImpl.withOptions = withOptions;
const createPlugin: CreatePluginFunction = createPluginImpl;

function withOptions<T>(
  pluginFn: (options?: T) => BoundedPluginCreator,
  configFn: (options?: T) => Partial<Config> = () => ({}),
): PluginWithOptions<T> {
  const optionsFunction = function(options?: T) {
    return {
      __options: options,
      handler: (api: PluginAPI) => pluginFn(options)(autoBind(api)),
      config: configFn(options),
    };
  };
  optionsFunction.__isOptionsFunction = true as const;
  // Expose plugin dependencies so that `object-hash` returns a different
  // value if anything here changes, to ensure a rebuild is triggered.
  // Follows Tailwind v3 original implementation
  optionsFunction.__pluginFunction = pluginFn;
  optionsFunction.__configFunction = configFn;
  return optionsFunction as PluginWithOptions<T>;
}

/**
 * Type guard
 */
function isPluginWithOptions<T = unknown>(
  plugin: unknown,
): plugin is PluginWithOptions<T> {
  return (
    typeof plugin === 'function'
    && '__isOptionsFunction' in plugin
    && (plugin as Record<string, unknown>)['__isOptionsFunction'] === true
  );
}

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
function autoBind<T extends object>(obj: T): Bound<T> {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) =>
      isFunction(v) ? [k, v.bind(undefined)] : [k, v]
    ),
  ) as Bound<T>;
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
  return _createUtilityPlugin.default(
    themeKey,
    utilityVariations as unknown,
    options,
  );
}

export { createUtilityPlugin, createPlugin, autoBind, isPluginWithOptions };
export type { Plugin, PluginWithOptions };

/* ──────────────── typed exports for transform/shadow utils ─────────── */

export const transformThemeValue: (key: ThemeKey) => ValueTransformer =
  _transformThemeValue.default;
export { parseBoxShadowValue, formatBoxShadowValue };

/* ──────────────── for handling variants that do not respect the project prefix ─────────── */
/**
 * @internal Tailwind implementation detail. Use via TW_NO_PREFIX to avoid prefixing of class candidates.
 */

interface InternalFeatures {
  [INTERNAL_FEATURES]: {
    respectPrefix: false;
  };
}

export const TW_NO_PREFIX: InternalFeatures = {
  [INTERNAL_FEATURES]: { respectPrefix: false },
};
