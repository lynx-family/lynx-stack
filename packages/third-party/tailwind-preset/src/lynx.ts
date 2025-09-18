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
  toEnabledLynxUIPluginSet,
  toEnabledSet,
} from './core.js';
import type {
  LynxPluginName,
  LynxPluginsOption,
  LynxUIPluginsOption,
} from './core.js';
import { lynxTheme } from './theme.js';

/**
 * Should be used with Tailwind v3+ (JIT is enabled by default) and configured with `content`,
 * otherwise the generated CSS bundle may include unused utilities.
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
  const uiSetEnabled = toEnabledLynxUIPluginSet(lynxUIPlugins);

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
    if (uiSetEnabled.has(name)) {
      const fn = LYNX_UI_PLUGIN_MAP[name];
      plugins.push(fn(options));
      if (debug) console.debug(`[Lynx] enabled UI plugin: ${name}`);
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
