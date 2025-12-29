// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createPlugin } from '../helpers.js';
import type { Plugin } from '../helpers.js';
import { getModifierRepeaterMap } from './get-modifier-repeater-map.js';

export function createTransitionTimingPlugin(
  cssProperty: string,
  classPrefix: string,
  themeKey: string,
): Plugin {
  return createPlugin(({ matchUtilities, theme }) => {
    const transitionProps = theme('transitionProperty', {});
    const timingValues = theme(themeKey, {});

    matchUtilities(
      getModifierRepeaterMap(cssProperty, classPrefix, transitionProps, {
        repeatedModifier: 'n',
        fillDelimiter: ', ',
        splitDelimiter: ',',
        skipIfSingleProperty: true,
      }),
      {
        values: Object.fromEntries(
          Object.entries(timingValues).filter(([modifier]) =>
            modifier !== 'DEFAULT'
          ),
        ),
      },
    );
  });
}
