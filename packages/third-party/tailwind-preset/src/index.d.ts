// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

declare module 'tailwindcss/lib/util/createUtilityPlugin.js' {
  import type { PluginCreator } from 'tailwindcss/types/config';

  import type { UtilityPluginOptions, UtilityVariations } from './types.js';

  const createUtilityPlugin: (
    themeKey: string,
    utilityVariations?: UtilityVariations,
    options?: UtilityPluginOptions,
  ) => PluginCreator;

  export default createUtilityPlugin;
}
