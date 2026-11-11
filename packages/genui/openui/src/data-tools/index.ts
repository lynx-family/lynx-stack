// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Platform-independent Query defaults, local mutations, and host persistence for OpenUI.
 * @packageDocumentation
 */
export { getQueryDefaults } from './queryDefaults.js';
export type { QueryDefaultsOptions } from './queryDefaults.js';
export { createQueryDataStore } from './store.js';
export { OPENUI_DATA_TOOL_NAMES, createQueryDataTools } from './tools.js';
export type {
  QueryDataToolRequest,
  QueryDataTools,
  QueryDataToolsOptions,
} from './tools.js';
export type {
  InitialQueryResults,
  QueryDataStorage,
  QueryDataStore,
  QueryDataStoreOptions,
} from './types.js';
