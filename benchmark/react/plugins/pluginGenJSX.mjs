// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import MagicString from 'magic-string';

import { gen } from './gen.js';

/**
 * @returns {import("@lynx-js/rspeedy").RsbuildPlugin}
 */
export const pluginGenJSX = () => ({
  name: 'pluginGenJSX',
  /**
   * @param {import("@lynx-js/rspeedy").RsbuildPluginAPI} api
   */
  setup(api) {
    api.transform({}, (context) => {
      const code = new MagicString(context.code);
      code.replace(/__GENERATE_JSX__\((\d+), ?(\d+)\)/g, (_, $1, $2) => {
        return gen(parseInt($1, 10), parseInt($2, 10));
      });
      const sourceMap = code.generateMap({
        hires: true,
        includeContent: true,
        source: context.resourcePath,
      });

      return {
        code: code.toString(),
        map: sourceMap,
      };
    });
  },
});
