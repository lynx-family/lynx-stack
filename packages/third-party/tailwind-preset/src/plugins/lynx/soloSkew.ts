// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createPlugin } from '../../helpers.js';
import type { Plugin } from '../../helpers.js';
import type {
  CSSRuleObject,
  KeyValuePair,
} from '../../types/tailwind-types.js';

export const soloSkew: Plugin = createPlugin(({
  matchUtilities,
  theme,
}) => {
  matchUtilities(
    {
      'solo-skew': (value: unknown) => {
        if (typeof value !== 'string') {
          return null;
        }
        const result: CSSRuleObject = {
          transform: `skew(${value})`,
        };
        return result;
      },
      'solo-skew-x': (value: unknown) => {
        if (typeof value !== 'string') {
          return null;
        }
        const result: CSSRuleObject = {
          transform: `skewX(${value})`,
        };
        return result;
      },
      'solo-skew-y': (value: unknown) => {
        if (typeof value !== 'string') {
          return null;
        }
        const result: CSSRuleObject = {
          transform: `skewY(${value})`,
        };
        return result;
      },
    },
    {
      supportsNegativeValues: true,
      values: theme('skew') as KeyValuePair,
    },
  );
});
