// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { vi } from 'vitest';
import type { Mock } from 'vitest';

import type { RuntimePluginAPI } from './mock-api.js';
import { mockPluginAPI } from './mock-api.js';
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

  /* Expose API for assertions */
  return { api };
}

/**
 * Helper to cast a runtime plugin API method to a vi.Mock for assertion use.
 * Ensures type safety for .mock.calls and other spy methods.
 */
export function getMock<T extends (...args: any[]) => any>(fn: T): Mock<T> {
  return fn as unknown as Mock<T>;
}
