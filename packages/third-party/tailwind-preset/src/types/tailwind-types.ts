// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type {
  Config,
  CorePluginsConfig,
  PluginAPI,
  PluginCreator,
  PluginUtils,
  PluginsConfig,
} from 'tailwindcss/types/config';

export type {
  PluginAPI,
  PluginCreator,
  PluginUtils,
  PluginsConfig,
  CorePluginsConfig,
  Config,
};

export type Plugin = PluginsConfig[number];
