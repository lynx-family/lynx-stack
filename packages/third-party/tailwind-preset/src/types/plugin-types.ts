// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type {
  Config,
  PluginAPI,
  PluginCreator,
  ValueType,
} from './tailwind-types.js';

/** Anything that is legal on the right-hand side of a CSS-in-JS object. */
type CSSStatic =
  | string // "rotate(45deg)"
  | number // 0 | 1
  | string[] // ["var(--x)", "var(--y)"]
  | Record<string, unknown> // {} or nested objects
  | null
  | undefined;

/**
 * A single “property” entry in Tailwind’s `createUtilityPlugin` spec.
 *
 *  - `string`:   dynamic property — Tailwind will call `transformValue(value)`
 *  - `[prop, V]` static          — fixed value copied as-is
 *  - `[prop, fn]` computed       — your own transformer `(v) => {…}`
 */
type PropertyEntry<
  V = CSSStatic | ((value: string) => CSSStatic),
> = string | [string, V];

/** `[classPrefix, properties]` */
type UtilityEntry = [string, PropertyEntry[]];
/** A “group” of rules that share the same `matchUtilities` call. */
type UtilityGroup = UtilityEntry | UtilityEntry[];

/** Everything Tailwind accepts as the second parameter. */
type UtilityVariations = UtilityGroup | UtilityGroup[];

interface UtilityPluginOptions {
  type?: ValueType | ValueType[];
  supportsNegativeValues?: boolean;
  filterDefault?: boolean;
}

/**
 * Type helper: binds all function-valued properties in T.
 */
type Bound<T> = {
  [K in keyof T]: T[K] extends (...args: infer A) => infer R
    ? (this: void, ...args: A) => R
    : T[K];
};

type BoundedPluginCreator = (api: Bound<PluginAPI>) => void;

interface OptionsFn<T> {
  (options: T): { handler: PluginCreator; config?: Partial<Config> };
  __isOptionsFunction: true;
}

interface PluginFn {
  (
    pluginFn: BoundedPluginCreator,
    cfg?: Partial<Config>,
  ): { handler: PluginCreator; config?: Partial<Config> | undefined };
  withOptions<T>(
    factory: (opts: T) => BoundedPluginCreator,
    cfgFactory?: (opts: T) => Partial<Config>,
  ): {
    (opts: T): { handler: PluginCreator; config?: Partial<Config> | undefined };
    __isOptionsFunction: true;
  };
}

export type {
  CSSStatic,
  PropertyEntry,
  UtilityEntry,
  UtilityGroup,
  UtilityVariations,
  UtilityPluginOptions,
  BoundedPluginCreator,
  OptionsFn,
  PluginFn,
  Bound,
};
