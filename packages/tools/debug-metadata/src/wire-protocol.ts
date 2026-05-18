// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * `module.buildInfo[UI_SOURCE_MAP_RECORDS_BUILD_INFO]` is where the
 * main-thread loader stashes the {@link UiSourceMapRecord} array it
 * extracts from a module, for `LynxDebugMetadataPlugin` to collect.
 *
 * Lives in this zero-dependency schema package so producer
 * (`@lynx-js/react-webpack-plugin`'s loader) and consumer
 * (`@lynx-js/debug-metadata-rsbuild-plugin`) can both read the same
 * constant without taking a runtime dep on each other.
 *
 * @public
 */
export const UI_SOURCE_MAP_RECORDS_BUILD_INFO = 'lynxUiSourceMapRecords';

/**
 * One UI source map record produced by the main-thread loader.
 *
 * @public
 */
export interface UiSourceMapRecord {
  uiSourceMap: number;
  filename: string;
  lineNumber: number;
  columnNumber: number;

  [key: string]: unknown;
}
