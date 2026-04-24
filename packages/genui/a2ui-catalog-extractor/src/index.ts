// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
export {
  checkCatalogFiles,
  extractCatalog,
  loadCatalogConfig,
  renderCatalogFiles,
  writeCatalogFiles,
} from './extractor.ts';

export type {
  CatalogComponent,
  CatalogFile,
  CatalogFormat,
  CheckCatalogFilesResult,
  ComponentSchema,
  ExtractCatalogOptions,
  ExtractCatalogResult,
  JsonSchema,
  JsonValue,
  LoadCatalogConfigResult,
  RenderCatalogFilesOptions,
} from './types.ts';
