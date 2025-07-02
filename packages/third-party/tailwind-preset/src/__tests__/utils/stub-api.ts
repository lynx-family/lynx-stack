// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { PluginAPI } from '../../types/tailwind-types.js';

export interface RuntimePluginAPI extends PluginAPI {
  prefix: (className: string) => string;
  variants: (key: string) => string[];
}

export function stubApi(
  overrides: Partial<RuntimePluginAPI> = {},
): RuntimePluginAPI {
  const base: RuntimePluginAPI = {
    /* ---------- Tailwind helpers ---------- */
    addUtilities: () => {},
    addComponents: () => {},
    addBase: () => {},
    addVariant: () => {},
    matchUtilities: () => {},
    matchComponents: () => {},
    matchVariant: () => {},

    /* ---------- Config/theme helpers ---------- */
    // Just echo the supplied default value back so the generic is satisfied.
    config: (<TDefault = unknown>(
      _path?: string,
      defaultValue?: TDefault,
    ): TDefault => defaultValue as TDefault) as PluginAPI['config'],

    theme: (<TDefault = unknown>(
      _path?: string,
      defaultValue?: TDefault,
    ): TDefault => defaultValue as TDefault) as PluginAPI['theme'],

    corePlugins: ((_name?: string) => false) as PluginAPI['corePlugins'],

    /* ---------- String helpers ---------- */
    prefix: (className) => `tw-${className}`,
    e: (className) => className.replace(/[^a-z0-9-]/gi, (c) => `\\${c}`),
    variants: () => [],
  };

  // Allow per-test overrides / spies.
  return { ...base, ...overrides };
}
