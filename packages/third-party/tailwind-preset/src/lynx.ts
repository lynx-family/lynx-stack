// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Config } from 'tailwindcss';

import { DEFAULT_CORE_PLUGINS, LYNX_PLUGIN_MAP, toEnabledSet } from './core.js';
import type { LynxPluginName, LynxPluginsOption } from './core.js';
import { lynxTheme } from './theme.js';

/**
 * Should be used with Tailwind v3+ (JIT is enabled by default) and configured with `content`,
 * otherwise the generated CSS bundle may include unused utilities.
 */

function createLynxPreset({
  lynxPlugins = true,
  debug = false,
  theme,
}: {
  lynxPlugins?: LynxPluginsOption;
  debug?: boolean;
  theme?: Config['theme'];
} = {}): Partial<Config> {
  const enabled = toEnabledSet(lynxPlugins);

  const defaultPluginName: LynxPluginName = 'defaults';

  const plugins: Config['plugins'] = [LYNX_PLUGIN_MAP[defaultPluginName]];
  for (const name of enabled) {
    plugins.push(LYNX_PLUGIN_MAP[name]);
    if (debug) {
      console.debug(`[Lynx] enabled plugin: ${name}`);
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
