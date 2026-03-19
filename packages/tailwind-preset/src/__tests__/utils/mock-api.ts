// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { vi } from 'vitest';
import type { Mock } from 'vitest';

import type { PluginAPI } from '../../types/tailwind-types.js';

/**
 * Extends Tailwind's PluginAPI with mockable versions of core methods.
 * Used for testing plugin registration behavior in isolation.
 */
export interface RuntimePluginAPI extends PluginAPI {
  matchUtilities: Mock;
  matchComponents: Mock;
  addUtilities: Mock;
  addComponents: Mock;
  addBase: Mock;
  addVariant: Mock;
  matchVariant: Mock;
  corePlugins: Mock;
  config: Mock;

  prefix: (className: string) => string;
  variants: (key: string) => string[];
}

/**
 * Creates a stubbed PluginAPI implementation for plugin tests,
 * with spies for utility registration and config/theme access.
 */
export function mockPluginAPI(
  overrides: Partial<RuntimePluginAPI> = {},
  themeVals: Record<string, unknown> = {},
): RuntimePluginAPI {
  const base: RuntimePluginAPI = {
    matchUtilities: vi.fn(),
    matchComponents: vi.fn(),
    addUtilities: vi.fn(),
    addComponents: vi.fn(),
    addBase: vi.fn(),
    addVariant: vi.fn(),
    matchVariant: vi.fn(),
    corePlugins: vi.fn().mockReturnValue(true),
    config: vi.fn((_key: string, def?: unknown) => def),
    theme: (<T = unknown>(path?: string, defaultValue?: T): T => {
      if (!path) return defaultValue as T;
      const keys = path.split('.');
      let current: unknown = themeVals;
      for (const key of keys) {
        if (
          typeof current === 'object'
          && current !== null
          && key in current
        ) {
          current = (current as Record<string, unknown>)[key];
        } else {
          return defaultValue as T;
        }
      }
      return current as T;
    }) as RuntimePluginAPI['theme'],
    prefix: (className) => `tw-${className}`,
    e: (className) => className.replace(/[^a-z0-9-]/gi, (c) => `\\${c}`),
    variants: () => [],
    ...overrides,
  };

  return base;
}
