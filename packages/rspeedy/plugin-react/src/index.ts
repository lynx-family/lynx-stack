// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * @packageDocumentation
 *
 * A rsbuild plugin that integrates with ReactLynx.
 */

export { pluginReactLynx } from './pluginReactLynx.js'
export type { PluginReactLynxOptions } from './pluginReactLynx.js'

export type {
  AddComponentElementConfig,
  CompatVisitorConfig,
  DefineDceVisitorConfig,
  ExtractStrConfig,
  ShakeVisitorConfig,
} from '@lynx-js/react-transform'

export { LAYERS } from '@lynx-js/react-webpack-plugin'
