// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createOpenUiLibraryWithDefaults } from './createLibraryBase.js';
import type { CreateOpenUiLibraryOptions } from './createLibraryBase.js';
import type { Library } from './library.jsx';
import * as c from '../catalog/index.js';
import {
  DEFAULT_COMPONENT_GROUPS,
  getDefaultComponents,
} from '../shared/defaultCatalog.js';

export type { CreateOpenUiLibraryOptions } from './createLibraryBase.js';

/**
 * Create a ReactLynx OpenUI library with caller-provided components and,
 * unless disabled, the built-in components.
 */
export function createOpenUiLibrary(
  options?: CreateOpenUiLibraryOptions,
): Library {
  return createOpenUiLibraryWithDefaults(options, {
    components: getDefaultComponents(c),
    componentGroups: DEFAULT_COMPONENT_GROUPS,
  });
}
