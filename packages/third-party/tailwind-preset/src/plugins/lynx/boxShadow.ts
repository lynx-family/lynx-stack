// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  createPlugin,
  parseBoxShadowValue,
  transformThemeValue,
  // formatBoxShadowValue,
} from '../../helpers.js';
import type {
  CSSRuleObject,
  KeyValuePair,
} from '../../types/tailwind-types.js';

// const transparentShadow = `0 0 0 0 transparent`;

export const boxShadow = (() => {
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
        shadow: (value) => {
          value = transformValue(value);

          const ast = parseBoxShadowValue(value as string);
          for (const shadow of ast) {
            // Don't override color if the whole shadow is a variable
            if (!shadow.valid) {
              continue;
            }

            // Lynx does not support nested variable
            // uncomment in the future
            // shadow.color = 'var(--tw-shadow-color)';
          }

          return {
            // Bug in box-shadow & CSS var
            // uncomment in the future
            /*
            '@defaults box-shadow': {},
            '--tw-shadow': value === 'none' ? transparentShadow : value,
            '--tw-shadow-colored': value === 'none'
              ? transparentShadow
              : formatBoxShadowValue(ast), */
            'box-shadow': value,
          } as CSSRuleObject;
        },
      },
      {
        values: theme('boxShadow') as KeyValuePair<string, string>,
        type: ['shadow'],
      },
    );
  });
})();
