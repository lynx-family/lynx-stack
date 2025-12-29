// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  createPlugin,
  transformThemeValue,
  // parseBoxShadowValue,
  // formatBoxShadowValue,
} from '../../helpers.js';
import type { CSSRuleObject, Plugin } from '../../types/tailwind-types.js';

// const transparentShadow = `0 0 0 0 transparent`;

export const boxShadow: Plugin = (() => {
  // Keep theme-based defaultShadow in closure
  // avoid recalculation

  const transformValue = transformThemeValue('boxShadow');
  /*
  let defaultBoxShadow = [
    `var(--tw-ring-offset-shadow)`,
    `var(--tw-ring-shadow)`,
    `var(--tw-shadow)`,
  ].join(', '); */

  return createPlugin(({ matchUtilities, theme }) => {
    matchUtilities(
      {
        shadow: (_value: unknown) => {
          const resolved = transformValue(_value);

          if (typeof resolved !== 'string') return null;

          // Lynx does not support nesting CSS variables
          // uncomment this block in the future

          /*
          const ast = parseBoxShadowValue(resolved as string);
          for (const shadow of ast) {
            // Don't override color if the whole shadow is a variable
            if (!shadow.valid) {
              continue;
            }
            shadow.color = 'var(--tw-shadow-color)';
          } */

          return {
            // Bug in box-shadow & CSS var
            // uncomment in the future
            /*
            '--tw-shadow': value === 'none' ? transparentShadow : value,
            '--tw-shadow-colored': value === 'none'
              ? transparentShadow
              : formatBoxShadowValue(ast), */
            'box-shadow': resolved,
          } as CSSRuleObject;
        },
      },
      {
        values: theme('boxShadow'),
        type: ['shadow'],
      },
    );
  });
})();
