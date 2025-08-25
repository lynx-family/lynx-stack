// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { PluginCreator } from 'postcss';

/**
 * The option of the plugin.
 *
 * @public
 */
export interface PluginOption {
  /**
   * The engine version of Lynx.
   */
  engineVersion?: string | undefined;
}

/**
 * Create a PostCSS plugin
 *
 * @returns A PostCSS plugin
 *
 * @public
 */
const creator: PluginCreator<PluginOption> = (_) => {
  return {
    postcssPlugin: 'lynx:postcss-scoped-css',
    Once() {
      // TODO: implement this later
    },
  };
};

creator.postcss = true;

export default creator;
