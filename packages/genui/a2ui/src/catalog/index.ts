// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
export {
  defineCatalog,
  mergeCatalogs,
  resolveCatalog,
  serializeCatalog,
} from './defineCatalog.js';
export type {
  Catalog,
  CatalogComponent,
  CatalogInput,
  CatalogManifest,
  CatalogSchema,
  ResolvedCatalogEntry,
  SerializedCatalog,
} from './defineCatalog.js';

// Existing global-registry exports — kept for back-compat with the
// current `core/A2UIRender` path. The new `defineCatalog` API above is
// the pluggable, side-effect-free alternative.
export * from './all.js';
