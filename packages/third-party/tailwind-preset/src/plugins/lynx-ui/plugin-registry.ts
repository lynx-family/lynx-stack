// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { UIVariantsOptions } from './uiVariants.js';
import type { PluginWithOptions } from '../../helpers.js';

import * as P from './index.js';

type Entry<K extends LynxUIPluginName> = readonly [
  K,
  PluginWithOptions<LynxUIPluginOptionsMap[K]>,
];

interface LynxUIPluginOptionsMap {
  uiVariants: UIVariantsOptions;
}
type LynxUIPluginName = keyof LynxUIPluginOptionsMap;

export const LYNX_UI_PLUGIN_ENTRIES: readonly [
  Entry<'uiVariants'>,
  // LynxUIPluginEntry<'anotherPlugin'>
] = [
  [
    'uiVariants',
    P.uiVariants,
  ],
  // ['anotherPlugin', P.anotherPlugin],
] as const;

type EntryUnion = typeof LYNX_UI_PLUGIN_ENTRIES[number];
type PluginMap = {
  [K in EntryUnion[0]]: Extract<EntryUnion, readonly [K, any]>[1];
};
export const LYNX_UI_PLUGIN_MAP: PluginMap = Object.fromEntries(
  LYNX_UI_PLUGIN_ENTRIES,
) as unknown as PluginMap;

export const ORDERED_LYNX_UI_PLUGIN_NAMES: readonly LynxUIPluginName[] =
  LYNX_UI_PLUGIN_ENTRIES.map(([n]) => n as LynxUIPluginName);

export type { LynxUIPluginName, LynxUIPluginOptionsMap };
