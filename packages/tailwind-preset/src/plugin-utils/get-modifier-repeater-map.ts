// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createRepeaterUtility } from '../plugin-utils/create-repeater-utility.js';
import type { RepeaterOptions } from '../plugin-utils/create-repeater-utility.js';
import type { CSSRuleObject } from '../types/tailwind-types.js';

type UtilityFn = (value: unknown) => CSSRuleObject | null;

/**
 * Creates a map of utility classes for applying repeated timing values
 * based on a theme-defined "modifier → CSS properties" map.
 *
 * @param {string} cssProperty - The target CSS property (e.g., 'transition-delay')
 * @param {string} classPrefix - The utility class prefix (e.g., 'delay', 'duration', 'ease')
 * @param {Object} modifierMap - A map of class modifiers to property lists (e.g., theme('transitionProperty'))
 * @param {Object} options - Optional configuration
 * @param {string} [options.repeatedModifier] - If defined, generates `${classPrefix}-${repeatedModifier}` for DEFAULT group
 * @param {string} [options.splitDelimiter] - (from RepeaterOptions) Delimiter to split `matchValue`, defaults to `','`. Leading/trailing whitespaces are trimmed after splitting.
 * @param {string} [options.fillDelimiter] - (from RepeaterOptions) Delimiter to join repeated values, defaults to `', '`.
 * @param {boolean} [options.skipIfSingleProperty] - (from RepeaterOptions) If true, skips generating utilities for single-property groups.
 */
export function getModifierRepeaterMap(
  cssProperty: string,
  classPrefix: string,
  modifierMap: Record<string, string> | undefined,
  options?: {
    repeatedModifier?: string;
  } & Omit<RepeaterOptions, 'matchValue' | 'count'>,
): Record<string, UtilityFn> {
  const {
    repeatedModifier,
    ...repeaterOptions
  } = options ?? {};

  modifierMap = modifierMap ?? {};

  const entries = Object.entries(modifierMap);
  const defaultValue = modifierMap['DEFAULT'] ?? '';

  const namedEntries = entries.filter(([modifier]) => modifier !== 'DEFAULT');

  const result: Record<string, UtilityFn> = {};

  // base, no repeat: e.g. `delay`
  const base = createRepeaterUtility(cssProperty, { count: 1 });
  if (base) {
    result[classPrefix] = base;
  }

  if (repeatedModifier) {
    // repeated, match DEFAULT modifier: e.g. `delay-n`
    const repeated = createRepeaterUtility(cssProperty, {
      matchValue: defaultValue,
      ...repeaterOptions,
    });
    if (repeated) {
      result[`${classPrefix}-${repeatedModifier}`] = repeated;
    }
  }

  // named/scoped: e.g. `delay-colors`, `delay-visual`, ...
  for (const [modifier, value] of namedEntries) {
    const fn = createRepeaterUtility(cssProperty, {
      matchValue: value,
      ...repeaterOptions,
    });
    if (fn) {
      result[`${classPrefix}-${modifier}`] = fn;
    }
  }

  return result;
}
