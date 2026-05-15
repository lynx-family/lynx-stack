// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Wire-protocol key + payload type for UI source map records that loaders
 * attach to `module.buildInfo`. The producing loader lives in
 * `@lynx-js/react-webpack-plugin` and the consuming
 * `LynxDebugMetadataPlugin` lives in this package.
 */

/**
 * `module.buildInfo[UI_SOURCE_MAP_RECORDS_BUILD_INFO]` is where the
 * main-thread loader stashes the {@link UiSourceMapRecord} array it
 * extracts from a module, for the plugin to collect later.
 *
 * @public
 */
export const UI_SOURCE_MAP_RECORDS_BUILD_INFO = 'lynxUiSourceMapRecords'

/**
 * One UI source map record produced by the main-thread loader.
 *
 * @public
 */
export interface UiSourceMapRecord {
  uiSourceMap: number
  filename: string
  lineNumber: number
  columnNumber: number

  [key: string]: unknown
}
