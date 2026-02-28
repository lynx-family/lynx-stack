// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * @packageDocumentation
 *
 * A rsbuild plugin that integrates with ReactLynx.
 */

import type {
  LynxTemplatePlugin as InnerLynxTemplatePlugin,
  TemplateHooks,
} from '@lynx-js/template-webpack-plugin'

export { pluginReactLynx } from './pluginReactLynx.js'
export type { PluginReactLynxOptions } from './pluginReactLynx.js'

export type {
  AddComponentElementConfig,
  CompatVisitorConfig,
  DefineDceVisitorConfig,
  ExtractStrConfig,
  ShakeVisitorConfig,
} from '@lynx-js/react-transform'

interface LynxTemplatePlugin {
  getLynxTemplatePluginHooks:
    typeof InnerLynxTemplatePlugin.getLynxTemplatePluginHooks
}

// We only export types here
// It is encouraged to use `api.useExposed(Symbol.for('LynxTemplatePlugin'))`
// to access the actual API
/** @deprecated Use {@link LynxBundlePlugin} instead. `LynxTemplatePlugin` is a legacy name. */
export type { LynxTemplatePlugin }
/** @deprecated Use {@link BundleHooks} instead. `TemplateHooks` is a legacy name. */
export type { TemplateHooks }
export type { LynxTemplatePlugin as LynxBundlePlugin }
export type { TemplateHooks as BundleHooks }

export { LAYERS } from '@lynx-js/react-webpack-plugin'
