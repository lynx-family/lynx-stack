// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Config } from 'tailwindcss';

import {
  DEFAULT_CORE_PLUGINS,
  LYNX_PLUGIN_MAP,
  LYNX_UI_PLUGIN_MAP,
  ORDERED_LYNX_PLUGIN_NAMES,
  resolveUIPluginEntries,
  toEnabledSet,
} from './core.js';
import type {
  LynxPluginName,
  LynxPluginsOption,
  LynxUIPluginsOption,
} from './core.js';
import { lynxTheme } from './theme.js';

/**
 * Creates a Tailwind preset tailored for the Lynx ecosystem.
 *
 * @param options - Configuration options for the preset
 * @param options.lynxPlugins - Controls which Lynx core plugins to enable
 * @param options.lynxUIPlugins - Controls which Lynx UI plugins to enable
 * @param options.debug - Whether to enable debug logging
 * @param options.theme - Custom theme configuration to merge with Lynx theme
 *
 * @returns A partial Tailwind configuration object
 *
 * @remarks
 * - Requires **Tailwind v3+** (JIT enabled by default).
 * - Configure the `content` option in your Tailwind config;
 *   otherwise the generated CSS bundle may include unused utilities.
 * - The `defaults` plugin is always enabled regardless of configuration.
 * - Debug mode will log enabled plugins to the console.
 *
 * @defaultValue
 * - `lynxPlugins`: `true`
 * - `lynxUIPlugins`: `true` (starting with v0.4.0; includes `uiVariants`)
 * - `debug`: `false`
 * - `theme`: `undefined`
 *
 * @example Basic usage with all defaults
 * ```ts
 * const preset = createLynxPreset();
 * ```
 *
 * @example Opt out globally or per plugin
 * ```ts
 * // turn off all UI plugins
 * createLynxPreset({ lynxUIPlugins: false });
 *
 * // turn off a single UI plugin
 * createLynxPreset({ lynxUIPlugins: { uiVariants: false } });
 *
 * // enable debug mode
 * createLynxPreset({ debug: true });
 *
 * @since 0.1.0
 */
function createLynxPreset({
  lynxPlugins = true,
  lynxUIPlugins = true,
  debug = false,
  theme,
}: {
  lynxPlugins?: LynxPluginsOption;
  lynxUIPlugins?: LynxUIPluginsOption;
  debug?: boolean;
  theme?: Config['theme'];
} = {}): Partial<Config> {
  const coreSetEnabled = toEnabledSet(lynxPlugins);

  const defaultPluginName: LynxPluginName = 'defaults';

  const plugins: Config['plugins'] = [LYNX_PLUGIN_MAP[defaultPluginName]];

  // Lynx Core Plugins
  for (const name of ORDERED_LYNX_PLUGIN_NAMES) {
    if (name === 'defaults') continue; // already pushed
    if (coreSetEnabled.has(name)) {
      plugins.push(LYNX_PLUGIN_MAP[name]);
      if (debug) console.debug(`[Lynx] enabled core plugin: ${name}`);
    }
  }

  // Lynx UI Plugins
  for (const [name, options] of resolveUIPluginEntries(lynxUIPlugins)) {
    const fn = LYNX_UI_PLUGIN_MAP[name];

    // Invariant: map must contain every ordered name
    if (!fn) {
      if (debug) {
        const msg = `[Lynx] invariant: missing UI plugin impl for '${name}'`;
        console.debug(msg);
      }
      continue;
    }
    try {
      plugins.push(fn(options));
      if (debug) console.debug(`[Lynx] enabled UI plugin: ${name}`);
    } catch (err) {
      // Keep the stack; no need for instanceof / String(err)
      if (debug) {
        console.warn(`[Lynx] failed to initialize UI plugin '${name}'`, err);
      }
    }
  }

  return {
    plugins,
    corePlugins: DEFAULT_CORE_PLUGINS satisfies NonNullable<
      Config['corePlugins']
    >,
    theme: { ...lynxTheme, ...theme },
  };
}

const preset: Partial<Config> = createLynxPreset();

export default preset;

export { createLynxPreset };

export type { LynxPluginName };
