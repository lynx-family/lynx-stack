// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { cssTransformValue, cssTransformVarMap } from './transform.js';
import { createPlugin } from '../../helpers.js';
import type { Plugin } from '../../helpers.js';
import type { CSSRuleObject } from '../../types/tailwind-types.js';

/**
 * Base on https://github.com/tailwindlabs/tailwindcss/blob/d1f066d97a30539c1c86aa987c75b6d84ef29609/src/corePlugins.js#L476
 */
export const translate: Plugin = createPlugin(({ matchUtilities, theme }) => {
  matchUtilities(
    {
      'translate-x': (value: unknown) => {
        if (typeof value !== 'string') {
          return null;
        }
        const result: CSSRuleObject = {
          [cssTransformVarMap.translateX]: value,
          transform: cssTransformValue,
        };
        return result;
      },
    },
    {
      supportsNegativeValues: true,
      values: theme('translate'),
    },
  );
  matchUtilities(
    {
      'translate-y': (value: unknown) => {
        if (typeof value !== 'string') {
          return null;
        }
        const result: CSSRuleObject = {
          [cssTransformVarMap.translateY]: value,
          transform: cssTransformValue,
        };
        return result;
      },
    },
    {
      supportsNegativeValues: true,
      values: theme('translate'),
    },
  );
  matchUtilities(
    {
      'translate-z': (value: unknown) => {
        if (typeof value !== 'string' || value.includes('%')) {
          return null;
        }
        const result: CSSRuleObject = {
          [cssTransformVarMap.translateZ]: value,
          transform: cssTransformValue,
        };
        return result;
      },
    },
    {
      supportsNegativeValues: true,
      values: theme('translate'),
    },
  );
});
