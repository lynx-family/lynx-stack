// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type {
  CSSRuleObject,
  Config,
  CorePluginsConfig,
  KeyValuePair,
  PluginAPI,
  PluginCreator,
  PluginUtils,
  PluginsConfig,
  ResolvableTo,
  ThemeConfig,
  ValueType,
} from 'tailwindcss/types/config.js';

export type {
  PluginAPI,
  PluginCreator,
  PluginUtils,
  PluginsConfig,
  CorePluginsConfig,
  Config,
  ValueType,
  CSSRuleObject,
  KeyValuePair,
  ThemeConfig,
  ResolvableTo,
};

export type Plugin = PluginsConfig[number];
