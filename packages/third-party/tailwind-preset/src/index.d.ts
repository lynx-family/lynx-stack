// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

declare module 'tailwindcss/lib/util/createUtilityPlugin.js' {
  import type { PluginCreator } from 'tailwindcss/types/config';

  type PropertyEntry =
    | string
    | [string, string]
    | [string, [string, string]];

  type UtilityEntry = [string, PropertyEntry[]];

  type UtilityVariation = UtilityEntry | UtilityEntry[];

  interface UtilityPluginOptions {
    type?: string[];
    supportsNegativeValues?: boolean;
    filterDefault?: boolean;
  }

  const createUtilityPlugin: (
    themeKey: string,
    utilityVariations?: UtilityVariation[] | UtilityVariation,
    options?: UtilityPluginOptions,
  ) => PluginCreator;

  export default createUtilityPlugin;
}
