// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createPlugin } from '../../helpers.js';
import type { CSSRuleObject, Plugin } from '../../types/tailwind-types.js';

export const gridRow: Plugin = createPlugin(
  ({ matchUtilities, theme }) => {
    matchUtilities(
      {
        row: (value: unknown) => {
          if (typeof value !== 'string') {
            return null;
          }

          const [start, end] = value.split('/').map((s) => s.trim());

          return {
            gridRowStart: start,
            gridRowEnd: end ?? start,
          } as CSSRuleObject;
        },
      },
      { values: theme('gridRow') },
    );
  },
);
