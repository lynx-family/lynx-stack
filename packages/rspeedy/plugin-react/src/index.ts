// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * @packageDocumentation
 *
 * A rsbuild plugin that integrates with ReactLynx.
 */

import type {
  BundleHooks,
  LynxTemplatePlugin as InnerLynxTemplatePlugin,
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

/**
 * The exposed Lynx Bundle Plugin API.
 *
 * @public
 */
interface LynxBundlePlugin {
  getLynxTemplatePluginHooks:
    typeof InnerLynxTemplatePlugin.getLynxTemplatePluginHooks
}

// We only export types here
// It is encouraged to use `api.useExposed(Symbol.for('LynxBundlePlugin'))`
// to access the actual API
export type { LynxBundlePlugin }
export type { BundleHooks }
/** @deprecated Use {@link LynxBundlePlugin} instead. */
export type { LynxBundlePlugin as LynxTemplatePlugin }
/** @deprecated Use {@link BundleHooks} instead. */
export type { BundleHooks as TemplateHooks }

export { LAYERS } from '@lynx-js/react-webpack-plugin'
