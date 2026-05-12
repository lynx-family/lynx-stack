// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useA2UIContext } from './useA2UIContext.js';
import type { CatalogComponent } from '../catalog/defineCatalog.js';

/**
 * Internal hook — returns the resolved name → component map. Used by the
 * renderer and exposed for advanced custom components that want to peek
 * at the active catalog.
 */
export function useCatalog(): ReadonlyMap<string, CatalogComponent> {
  return useA2UIContext().catalogMap;
}
