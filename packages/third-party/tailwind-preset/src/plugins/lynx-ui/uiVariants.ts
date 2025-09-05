// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * uiVariants
 * -----------------------------------------------------------------------------
 * A plugin for generating class-based Tailwind variants based on component state,
 * structure, or configuration — using a unified `ui-*` class prefix (customizable).
 *
 * This is inspired by stateful or structural variants commonly expressed via
 * `data-*` or `aria-*` attributes in Headless UI / Radix UI, but adapted to
 * Lynx platform where attribute selectors are not available.
 *
 * For example, instead of `[data-state="open"]`, we use `.ui-open:*`.
 *
 * Example:
 *  <div class="ui-open:bg-blue-500 ui-side-left:border-l" />
 *
 * Supports:
 * - State-like values: `open`, `checked`, `disabled`
 * - Structural roles: `side`, `align`, etc.
 * - Custom mappings via object syntax
 */

import { createPlugin } from '../../helpers.js';
import type { PluginWithOptions } from '../../helpers.js';
import type { KeyValuePairOrList } from '../../types/plugin-types.js';

/* -----------------------------------------------------------------------------
 * Default variant values per prefix
 * -------------------------------------------------------------------------- */

const DEFAULT_PREFIXES = {
  ui: [
    'active',
    'disabled',
    'readonly',
    'checked',
    'selected',
    'indeterminate',
    'invalid',
    'initial',
    'open',
    'closed',
    'leaving',
    'entering',
    'animating',
    'busy',
  ],
  'ui-side': ['left', 'right', 'top', 'bottom'],
  'ui-align': ['start', 'end', 'center'],
} as const;

type DefaultPrefixMap = typeof DEFAULT_PREFIXES;
type PrefixKey = keyof DefaultPrefixMap;
type PrefixConfig =
  | string[]
  | Record<string, KeyValuePairOrList>
  | ((defaults: DefaultPrefixMap) => Record<string, KeyValuePairOrList>);

interface UIVariantsOptions {
  /**
   * Configures state-based variant prefixes.
   *
   * You can provide:
   * - An array of prefixes to use their default states
   * - Or an object mapping each prefix to an array or map of custom states.
   * - An explicit object of prefix → values (array or map)
   *
   * @example
   * prefixes: ['ui'] // → `ui-checked:*`, `ui-open:*` using default states
   *
   * @example
   * prefixes: {
   *   ui: ['checked', 'open'],
   *   aria: { expanded: 'expanded', pressed: 'pressed' },
   * }
   */
  prefixes?: PrefixConfig;
}

/* -----------------------------------------------------------------------------
 * Plugin definition
 * -------------------------------------------------------------------------- */

const uiVariants: PluginWithOptions<UIVariantsOptions> = createPlugin
  .withOptions<
    UIVariantsOptions
  >(
    (options?: UIVariantsOptions) => ({ matchVariant }) => {
      options = options ?? {};
      const resolvedPrefixes = normalizePrefixes(options?.prefixes);

      const entries: [string, KeyValuePairOrList][] = Object.entries(
        resolvedPrefixes,
      );

      for (const [prefix, states] of entries) {
        const stateEntries: [string, string][] = Array.isArray(states)
          ? states.map((k) => [k, k])
          : Object.entries(states);

        const valueMap = Object.fromEntries(stateEntries);

        matchVariant(
          prefix,
          (value: string, { modifier }: { modifier?: string | null } = {}) => {
            const mapped = valueMap[value];
            if (!mapped || typeof mapped !== 'string') return '';
            const selector = `&.${prefix}-${mapped}`;
            return (modifier && typeof modifier === 'string')
              ? `${selector}\\/${modifier}`
              : selector;
          },
          {
            values: valueMap,
          },
        );
      }
    },
  );

export type { UIVariantsOptions };
export { uiVariants };

function normalizePrefixes(
  input?: PrefixConfig,
): Record<string, KeyValuePairOrList> {
  if (typeof input === 'function') {
    return input(DEFAULT_PREFIXES);
  }

  if (Array.isArray(input)) {
    return Object.fromEntries(
      input.map((prefix) => [
        prefix,
        DEFAULT_PREFIXES[prefix as PrefixKey] ?? [],
      ]),
    );
  }

  return input ?? { ui: DEFAULT_PREFIXES.ui };
}
