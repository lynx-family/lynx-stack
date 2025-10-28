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

import { TW_NO_PREFIX, createPlugin } from '../../helpers.js';
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
    (options?: UIVariantsOptions) =>
    ({ matchVariant, e: escapeClassName, config }) => {
      options = options ?? {};

      const cfgPrefix = config('prefix');
      const projectPrefix: string = typeof cfgPrefix === 'string'
        ? cfgPrefix
        : '';

      const resolvedPrefixes = normalizePrefixes(options?.prefixes);

      const entries: [string, KeyValuePairOrList][] = Object.entries(
        resolvedPrefixes,
      );

      for (const [prefix, states] of entries) {
        const stateEntries: [string, string][] = Array.isArray(states)
          ? states.map((k) => [k, k])
          : Object.entries(states);

        const valueMap = Object.fromEntries(stateEntries);

        // {prefix}-* (Self)
        // Matches when the element itself has the given state class
        // Example: `&.ui-checked`
        matchVariant(
          prefix,
          (value: string) => {
            const mapped = valueMap[value];
            if (!mapped || typeof mapped !== 'string') return '';

            const cls = escapeClassName(`${prefix}-${mapped}`);
            return `&.${cls}`;
          },
          {
            values: valueMap,
            ...TW_NO_PREFIX,
          },
        );

        // 2) group-{prefix}-* (Ancestor)
        // Matches when an ancestor element with `.group` also has the given state class
        // Example: `.group.ui-open &`  (with project prefix `tw-` => `.tw-group.ui-open &`)
        matchVariant(
          `group-${prefix}`,
          (value: string, { modifier }: { modifier?: string | null } = {}) => {
            const mapped = valueMap[value];
            if (!mapped || typeof mapped !== 'string') return '';

            const groupSelector = modifier
              ? `:merge(.${projectPrefix}group\\/${escapeClassName(modifier)})`
              : `:merge(.${projectPrefix}group)`;
            const cls = escapeClassName(`${prefix}-${mapped}`);

            return `${groupSelector}.${cls} &`;
          },
          {
            values: valueMap,
            ...TW_NO_PREFIX,
          },
        );

        // 3) peer-{prefix}-* (Sibling)
        // Matches when a preceding sibling with `.peer` also has the given state class
        // Example: `.peer.ui-open ~ &` (with project prefix `tw-` => `.tw-peer.ui-open ~ &`)
        matchVariant(
          `peer-${prefix}`,
          (value: string, { modifier }: { modifier?: string | null } = {}) => {
            const mapped = valueMap[value];
            if (!mapped || typeof mapped !== 'string') return '';

            const peerSelector = modifier
              ? `:merge(.${projectPrefix}peer\\/${escapeClassName(modifier)})`
              : `:merge(.${projectPrefix}peer)`;

            const cls = escapeClassName(`${prefix}-${mapped}`);

            return `${peerSelector}.${cls} ~ &`;
          },
          {
            values: valueMap,
            ...TW_NO_PREFIX,
          },
        );

        // 4) parent-{prefix}-* (Parent)
        // Matches when the *direct parent* element has the given state class
        // Example: `.ui-open > &`

        // Not Tailwind Default Variants, added for performance consideration on Lynx
        matchVariant(
          `parent-${prefix}`,
          (value: string) => {
            const mapped = valueMap[value];
            if (!mapped || typeof mapped !== 'string') return '';

            const cls = escapeClassName(`${prefix}-${mapped}`);
            return `.${cls} > &`;
          },
          {
            values: valueMap,
            ...TW_NO_PREFIX,
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
