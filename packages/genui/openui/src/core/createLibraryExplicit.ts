// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createOpenUiLibraryWithDefaults } from './createLibraryBase.js';
import type { CreateOpenUiLibraryOptions } from './createLibraryBase.js';
import type { Library } from './library.jsx';

/** Options for a Library assembled only from explicitly selected components. */
export type CreateExplicitOpenUiLibraryOptions =
  & Omit<CreateOpenUiLibraryOptions, 'includeDefaultComponents'>
  & { includeDefaultComponents: false };

/**
 * Create a catalog-free OpenUI Library from explicitly selected components.
 */
export function createOpenUiLibrary(
  options: CreateExplicitOpenUiLibraryOptions,
): Library {
  return createOpenUiLibraryWithDefaults(options, {
    components: [],
    componentGroups: [],
  });
}
