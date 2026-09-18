// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * @packageDocumentation
 *
 * An Rsbuild plugin that integrates Vanilla Lynx applications with Rspeedy.
 */

import type {
  LynxTemplatePlugin as InnerLynxTemplatePlugin,
  TemplateHooks,
} from '@lynx-js/template-webpack-plugin'

export { LAYERS, pluginVanillaLynx } from './pluginVanillaLynx.js'
export type {
  PluginVanillaLynxOptions,
  VanillaBundleFilename,
  VanillaBundleFilenameContext,
  VanillaLynxEntry,
} from './pluginVanillaLynx.js'

interface LynxTemplatePlugin {
  getLynxTemplatePluginHooks:
    typeof InnerLynxTemplatePlugin.getLynxTemplatePluginHooks
}

// Only export the exposed plugin API types. Consumers should retrieve the
// implementation with `api.useExposed(Symbol.for('LynxTemplatePlugin'))`.
export type { LynxTemplatePlugin, TemplateHooks }
