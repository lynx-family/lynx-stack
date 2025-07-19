// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createPlugin } from '../../helpers.js';
import type { Plugin } from '../../helpers.js';
import type {
  CSSRuleObject,
  KeyValuePair,
} from '../../types/tailwind-types.js';

export const soloScale: Plugin = createPlugin(({
  matchUtilities,
  theme,
}) => {
  matchUtilities(
    {
      'solo-scale': (value: unknown) => {
        if (typeof value !== 'string') {
          return null;
        }
        const result: CSSRuleObject = {
          transform: `scale(${value})`,
        };
        return result;
      },
      'solo-scale-x': (value: unknown) => {
        if (typeof value !== 'string') {
          return null;
        }
        const result: CSSRuleObject = {
          transform: `scaleX(${value})`,
        };
        return result;
      },
      'solo-scale-y': (value: unknown) => {
        if (typeof value !== 'string') {
          return null;
        }
        const result: CSSRuleObject = {
          transform: `scaleY(${value})`,
        };
        return result;
      },
    },
    {
      supportsNegativeValues: true,
      values: theme('scale') as KeyValuePair,
    },
  );
});
