// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { vi } from 'vitest';

import type { RuntimePluginAPI } from './stub-api.js';
import { stubApi } from './stub-api.js';
import type { Plugin, PluginCreator } from '../../types/tailwind-types.js';

/**
 * Normalize any kind of plugin into a usable PluginCreator
 */
function resolvePluginHandler(plugin: Plugin): PluginCreator {
  if (typeof plugin === 'function') return plugin;

  if (typeof plugin === 'object' && 'handler' in plugin) {
    return plugin.handler;
  }

  throw new Error('Invalid plugin type passed to runPlugin()');
}

interface RunPluginOptions {
  theme?: Record<string, unknown>;
  config?: Record<string, unknown>;
}

export function runPlugin(
  plugin: Plugin,
  opts: RunPluginOptions = {},
): {
  api: RuntimePluginAPI;
  matchUtilities: ReturnType<typeof vi.fn>;
  addUtilities: ReturnType<typeof vi.fn>;
  addBase: ReturnType<typeof vi.fn>;
  addComponents: ReturnType<typeof vi.fn>;
  addVariant: ReturnType<typeof vi.fn>;
  matchVariant: ReturnType<typeof vi.fn>;
  theme: RuntimePluginAPI['theme'];
  config: RuntimePluginAPI['config'];
  prefix: RuntimePluginAPI['prefix'];
  e: RuntimePluginAPI['e'];
} {
  const { theme: themeVals = {}, config: cfg = {} } = opts;
  const prefixValue = (cfg['prefix'] as string) ?? '';

  /* Build the API: start with stubApi, then layer spies / helpers on top */
  const api: RuntimePluginAPI = stubApi({
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
      (key: string, _def?: unknown): unknown => cfg[key],
    ),
    theme: (<T = unknown>(
      path?: string,
      def?: T,
    ): T => {
      if (!path) return def as T;
      const value = themeVals[path];
      return value === undefined ? (def as T) : (value as T);
    }) as RuntimePluginAPI['theme'],

    /* prefix that honours cfg.prefix */
    prefix: (cls: string) => `${prefixValue}${cls}`,
  });

  /* Execute the plugin */
  resolvePluginHandler(plugin)(api);

  /* Expose spies + helpers for assertions */
  return {
    api,
    /** vitest spies */
    matchUtilities: api.matchUtilities.bind(api) as ReturnType<typeof vi.fn>,
    addUtilities: api.addUtilities.bind(api) as ReturnType<typeof vi.fn>,
    addBase: api.addBase.bind(api) as ReturnType<typeof vi.fn>,
    addComponents: api.addComponents.bind(api) as ReturnType<typeof vi.fn>,
    addVariant: api.addVariant.bind(api) as ReturnType<typeof vi.fn>,
    matchVariant: api.matchVariant.bind(api) as ReturnType<typeof vi.fn>,
    /** handy accessors */
    theme: api.theme.bind(api),
    config: api.config.bind(api),
    prefix: api.prefix.bind(api),
    e: api.e.bind(api),
  };
}
