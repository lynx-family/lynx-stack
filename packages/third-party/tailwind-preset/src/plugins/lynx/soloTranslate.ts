// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createPlugin } from '../../helpers.js';
import type { Plugin } from '../../helpers.js';
import type {
  CSSRuleObject,
  KeyValuePair,
} from '../../types/tailwind-types.js';

export const soloTranslate: Plugin = createPlugin(
  ({ matchUtilities, theme }) => {
    matchUtilities(
      {
        'solo-translate-x': (value: unknown) => {
          if (typeof value !== 'string') {
            return null;
          }
          const result: CSSRuleObject = {
            transform: `translateX(${value})`,
          };
          return result;
        },
        'solo-translate-y': (value: unknown) => {
          if (typeof value !== 'string') {
            return null;
          }
          const result: CSSRuleObject = {
            transform: `translateY(${value})`,
          };
          return result;
        },
        'solo-translate-z': (value: unknown) => {
          if (typeof value !== 'string' || value.includes('%')) {
            return null;
          }
          const result: CSSRuleObject = {
            transform: `translateZ(${value})`,
          };
          return result;
        },
      },
      {
        supportsNegativeValues: true,
        values: theme('translate') as KeyValuePair,
      },
    );
  },
);
