// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createPlugin } from '../../helpers.js';
import type {
  CSSRuleObject,
  KeyValuePair,
} from '../../types/tailwind-types.js';

export const gridRow = createPlugin(({ matchUtilities, theme }) => {
  const values = theme('gridRow') as KeyValuePair<string, string>;

  matchUtilities(
    {
      row: (value) => {
        if (typeof value !== 'string') return {};

        const [start, end] = value.split('/').map((s) => s.trim());

        return {
          gridRowStart: start,
          gridRowEnd: end ?? start,
        } as CSSRuleObject;
      },
    },
    { values },
  );
});
