// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { ValueType } from './tailwind-types.js';

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

export type {
  CSSStatic,
  PropertyEntry,
  UtilityEntry,
  UtilityGroup,
  UtilityVariations,
  UtilityPluginOptions,
};
