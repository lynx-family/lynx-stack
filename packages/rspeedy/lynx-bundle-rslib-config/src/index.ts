// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * @packageDocumentation
 *
 * `@lynx-js/lynx-bundle-rslib-config` is the package that provides the configurations for bundling Lynx bundle with {@link https://rslib.rs/ | Rslib}.
 */
export {
  defineExternalBundleRslibConfig,
  LAYERS,
  builtInExternalsPresetDefinitions,
  reactLynxExternalsPreset,
  DEFAULT_EXTERNAL_BUNDLE_LIB_CONFIG as defaultExternalBundleLibConfig,
} from './externalBundleRslibConfig.js'
export type {
  EncodeOptions,
  ExposedLayers,
  ExternalBundleLibConfig,
  ExternalObject,
  Externals,
  ExternalsPresetDefinition,
  ExternalsPresetDefinitions,
  ExternalsPresets,
  ExternalsPresetValue,
  OutputConfig,
} from './externalBundleRslibConfig.js'
export { MainThreadRuntimeWrapperWebpackPlugin } from './webpack/MainThreadRuntimeWrapperWebpackPlugin.js'
export type { MainThreadRuntimeWrapperWebpackPluginOptions } from './webpack/MainThreadRuntimeWrapperWebpackPlugin.js'
