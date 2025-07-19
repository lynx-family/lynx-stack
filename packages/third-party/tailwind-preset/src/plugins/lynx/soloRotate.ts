// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createPlugin } from '../../helpers.js';
import type { Plugin } from '../../helpers.js';
import type {
  CSSRuleObject,
  KeyValuePair,
} from '../../types/tailwind-types.js';

export const soloRotate: Plugin = createPlugin(({
  matchUtilities,
  theme,
}) => {
  matchUtilities(
    {
      'solo-rotate': (value: unknown) => {
        if (typeof value !== 'string') {
          return null;
        }
        const result: CSSRuleObject = {
          transform: `rotate(${value})`,
        };
        return result;
      },
      'solo-rotate-x': (value: unknown) => {
        if (typeof value !== 'string') {
          return null;
        }
        const result: CSSRuleObject = {
          transform: `rotateX(${value})`,
        };
        return result;
      },
      'solo-rotate-y': (value: unknown) => {
        if (typeof value !== 'string') {
          return null;
        }
        const result: CSSRuleObject = {
          transform: `rotateY(${value})`,
        };
        return result;
      },
      'solo-rotate-z': (value: unknown) => {
        if (typeof value !== 'string') {
          return null;
        }
        const result: CSSRuleObject = {
          transform: `rotateZ(${value})`,
        };
        return result;
      },
    },
    {
      supportsNegativeValues: true,
      values: theme('rotate') as KeyValuePair,
    },
  );
});
