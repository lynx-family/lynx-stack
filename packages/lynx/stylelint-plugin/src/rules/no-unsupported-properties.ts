// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import fs from 'node:fs';
import { createRequire } from 'node:module';

import type { Declaration, Root } from 'postcss';
import type { PostcssResult, Rule, Utils } from 'stylelint';

const require = createRequire(import.meta.url);

export const ruleName = 'lynx/no-unsupported-properties';

export interface RuleOptions {
  /** Extra supported properties */
  allow?: string[];
  /** Properties to explicitly disallow (remove from supported set) */
  disallow?: string[];
}

function loadPropertyIndex(): Array<{ id?: number; name?: string }> {
  // Use require.resolve() to find the package regardless of hoisting layout.
  const jsonPath = require.resolve(
    '@lynx-js/css-defines/property_index.json',
  );
  const raw = fs.readFileSync(jsonPath, 'utf8');
  return JSON.parse(raw) as Array<{ id?: number; name?: string }>;
}

const messages = {
  rejected: (prop: string) => `Unsupported CSS property "${prop}" in Lynx.`,
};

function buildSupportedSet(options?: RuleOptions): Set<string> {
  const set = new Set<string>();

  for (const entry of loadPropertyIndex()) {
    if (typeof entry?.name === 'string') {
      set.add(entry.name.toLowerCase());
    }
  }

  for (const p of options?.allow ?? []) set.add(p.toLowerCase());
  for (const p of options?.disallow ?? []) set.delete(p.toLowerCase());

  return set;
}

export const rule: Rule = Object.assign(
  (primary: boolean, secondaryOptions: RuleOptions = {}) => {
    const enabled = primary !== null && primary !== false;
    if (!enabled) {
      return () => {
        return;
      };
    }

    const supported = buildSupportedSet(secondaryOptions);

    return async (root: Root, result: PostcssResult) => {
      const stylelintModule = await import('stylelint');
      const stylelintApi = stylelintModule.default;

      const report: Utils['report'] = stylelintApi.utils.report;

      root.walkDecls((decl: Declaration) => {
        const propRaw = decl.prop;
        if (!propRaw) return;

        // Ignore custom properties.
        if (propRaw.startsWith('--')) return;

        const prop = propRaw.toLowerCase();
        if (supported.has(prop)) return;

        // Ignore CSS variables usage like var(--foo) is in values, not prop.

        report({
          message: messages.rejected(propRaw),
          node: decl,
          result,
          ruleName,
          word: propRaw,
        });
      });
    };
  },
  {
    ruleName,
    messages,
    meta: {
      url: 'https://lynxjs.org/api/css/properties',
    },
  },
);
