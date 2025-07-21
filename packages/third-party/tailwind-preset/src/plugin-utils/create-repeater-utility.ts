// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { CSSRuleObject } from 'tailwindcss/types/config.js';

/**
 * Creates a utility function that repeats a given CSS value multiple times
 * and joins them into a single declaration for a specified property.
 *
 * This is useful for properties like `transition-delay` where the number
 * of comma-separated values must match the number of transitioned properties.
 *
 * The repeat count is determined in the following order:
 *
 * 1. If `count` is provided and is a valid number, it takes precedence.
 * 2. Otherwise, `matchValue` is split by `splitDeliminator` (default: ',') to infer the count.
 * 3. If neither provides a valid count, the utility will be skipped (returns `null`).
 *
 * @param {string} property - The CSS property to assign (e.g. `transition-delay`).
 * @param {RepeaterOptions} options - Configuration for repetition behavior.
 * @param {number} [options.count] - A fixed number of repetitions. Takes precedence over `matchValue`.
 * @param {string} [options.matchValue] - A string to infer repeat count from (e.g. `opacity, transform`).
 * @param {string} [options.splitDeliminator] - The delimiter to split `matchValue` with. Leading/trailing whitespaces are trimmed after splitting. Defaults to `','`
 * @param {string} [options.fillDeliminator] - The delimiter to join repeated values with. Defaults to `', '`.
 *
 * @returns A function that takes a value string and returns a repeated CSS declaration,
 *          or `null` if input is invalid.
 *
 * @example
 * createRepeaterUtility('transition-delay', { matchValue: 'opacity, transform' })('200ms');
 * // => { transition-delay: '200ms, 200ms' }
 *
 * @example
 * createRepeaterUtility('transition-delay', { count: 3 })('150ms');
 * // => { transition-delay: '150ms, 150ms, 150ms' }
 */
export function createRepeaterUtility(
  property: string,
  options: RepeaterOptions,
): (value: unknown) => CSSRuleObject | null {
  const {
    matchValue,
    count,
    splitDeliminator = ',',
    fillDeliminator = ', ',
  } = options;

  const valuesFromMatchValue =
    // If it's a plain list of idents, split it. Otherwise treat it as opaque.
    // plain list of indents: '<indent>, <indent>, ...'
    // opaque value: 'x, var(--a, c), y'
    typeof matchValue === 'string'
      ? (isPlainIdentList(matchValue)
        ? matchValue.split(splitDeliminator).map(v => v.trim()).filter(Boolean)
        : [matchValue]) // fallback to single item
      : null;

  const repeatCount =
    typeof count === 'number' && Number.isFinite(count) && count >= 1
      ? count
      : valuesFromMatchValue?.length ?? null;

  if (
    !property || typeof property !== 'string' || typeof repeatCount !== 'number'
    || repeatCount < 1
  ) {
    return (_value: unknown) => null;
  }
  return (value: unknown) => {
    if (typeof value !== 'string') return null;
    return {
      [property]: Array(repeatCount).fill(value).join(fillDeliminator),
    };
  };
}

/**
 * Options to control how a CSS value should be repeated and joined.
 */
export interface RepeaterOptions {
  /**
   * A string to infer repeat count from (e.g. 'opacity, transform').
   * Each segment will be trimmed after splitting.
   */
  matchValue?: string;

  /**
   * A fixed number of repetitions. Takes precedence over `matchValue` if both are present.
   */
  count?: number;

  /**
   * The delimiter used to split `matchValue` when inferring repeat count. Defaults to `','`.
   * Each segment is trimmed (i.e., leading/trailing spaces are removed) after splitting.
   */
  splitDeliminator?: string;

  /**
   * The delimiter used to join repeated values into a single declaration. Defaults to `', '`.
   */
  fillDeliminator?: string;
}

function isPlainIdentList(value: string): boolean {
  return !value.includes('var(') && !value.includes('calc(');
}
