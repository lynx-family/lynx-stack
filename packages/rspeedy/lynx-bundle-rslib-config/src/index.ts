// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * @packageDocumentation
 *
 * `@lynx-js/lynx-bundle-rslib-config` is the package that provides the configurations for bundling Lynx bundle with {@link https://rslib.rs/ | Rslib}.
 *
 * 1. Install the package:
 *
 * ```bash
 * pnpm add @lynx-js/lynx-bundle-rslib-config @rslib/core -D
 * ```
 *
 * 2. Add the following code to `rslib.config.ts`:
 *
 * ```ts
 * import { defineExternalBundleRslibConfig } from '@lynx-js/lynx-bundle-rslib-config'
 *
 * export default defineExternalBundleRslibConfig({
 *   id: 'my-utils',
 *   source: {
 *     entry: {
 *       utils: './src/utils.ts'
 *     }
 *   }
 * })
 * ```
 *
 * 3. Run the command `pnpm rslib build` and you will get the `my-utils.lynx.bundle` in the `dist` directory. You can upload the bundle to CDN or server.
 *
 * 4. Finally, you can fetch and load the external bundle through:
 *
 * ```js
 * const bundleUrl = 'http://cdn.com/my-utils.lynx.bundle'
 * lynx.fetchBundle(bundleUrl).wait(3) // timeout is 3s
 *
 * if (__BACKGROUND__) {
 *   const utils = lynx.loadScript('utils', { bundleName: bundleUrl })
 * } else {
 *   const utils = lynx.loadScript('utils__main-thread', { bundleName: bundleUrl })
 * }
 * ```
 *
 * For more detail, please refer to the {@link defineExternalBundleRslibConfig}.
 */
export {
  defineExternalBundleRslibConfig,
  defaultExternalBundleLibConfig,
  LAYERS,
} from './externalBundleRslibConfig.js'
export type { EncodeOptions } from './externalBundleRslibConfig.js'
export { ExternalBundleWebpackPlugin } from './webpack/ExternalBundleWebpackPlugin.js'
export type { ExternalBundleWebpackPluginOptions } from './webpack/ExternalBundleWebpackPlugin.js'
export { MainThreadRuntimeWrapperWebpackPlugin } from './webpack/MainThreadRuntimeWrapperWebpackPlugin.js'
export type { MainThreadRuntimeWrapperWebpackPluginOptions } from './webpack/MainThreadRuntimeWrapperWebpackPlugin.js'
