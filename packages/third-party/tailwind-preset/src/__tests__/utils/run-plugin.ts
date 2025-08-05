// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { vi } from 'vitest';

import type { RuntimePluginAPI } from './mock-api.js';
import { mockPluginAPI } from './mock-api.js';
import { isPluginWithOptions } from '../../helpers.js';
import type { PluginWithOptions } from '../../types/plugin-types.js';
import type { Plugin, PluginCreator } from '../../types/tailwind-types.js';

/**
 * Normalize any kind of plugin into a usable PluginCreator
 */
function resolvePluginHandler(
  plugin: Plugin,
  options?: unknown,
): PluginCreator {
  if (typeof plugin === 'function') {
    if (isPluginWithOptions(plugin)) {
      const resolved = (plugin as PluginWithOptions<any>)(options ?? {});
      if (!resolved?.handler) {
        throw new Error('Plugin factory did not return a valid handler');
      }
      return resolved.handler;
    }
    return plugin;
  }

  if (typeof plugin === 'object' && 'handler' in plugin) {
    return plugin.handler;
  }

  throw new Error('Invalid plugin type passed to runPlugin()');
}

interface RunPluginOptions {
  theme?: Record<string, unknown>;
  config?: Record<string, unknown>;
  options?: unknown;
}

export function runPlugin(
  plugin: Plugin,
  opts: RunPluginOptions = {},
): {
  api: RuntimePluginAPI;
} {
  const { theme: themeVals = {}, config: cfg = {} } = opts;
  const prefixValue = (cfg['prefix'] as string) ?? '';

  /* Build the API: start with mockPluginAPI, then layer spies / helpers on top */
  const api: RuntimePluginAPI = mockPluginAPI({
    /* spies for assertions */
    matchUtilities: vi.fn(),
    matchComponents: vi.fn(),
    addUtilities: vi.fn(),
    addBase: vi.fn(),
    addComponents: vi.fn(),
    addVariant: vi.fn(),
    matchVariant: vi.fn(),
    corePlugins: vi.fn().mockReturnValue(true),

    /* config + theme tailored for this invocation */
    config: vi.fn().mockImplementation(
      (_key: string, def?: unknown): unknown => cfg[_key] ?? def,
    ),
    /* prefix that honours cfg.prefix */
    prefix: (cls: string) => `${prefixValue}${cls}`,
  }, themeVals);

  /* Execute the plugin */
  resolvePluginHandler(plugin, opts)(api);

  /* Expose API for assertions */
  return { api };
}
