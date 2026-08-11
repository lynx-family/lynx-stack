// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  DEFAULT_COMPONENTS,
  DEFAULT_COMPONENT_GROUPS,
} from '#openui-default-components';

import { createLibrary } from './library.jsx';
import type { ComponentGroup, DefinedComponent, Library } from './library.jsx';

/** Options for creating a ReactLynx OpenUI component library. */
export interface CreateOpenUiLibraryOptions {
  /** Override the root component name. Defaults to `'Stack'`. */
  root?: string;
  /** Extend the active built-in component preset. */
  components?: DefinedComponent<any>[];
  /** Extend the active built-in component groups. */
  componentGroups?: ComponentGroup[];
}

/**
 * Create a ReactLynx OpenUI library with the active built-in component preset
 * plus any caller-provided extensions.
 */
export function createOpenUiLibrary(
  options?: CreateOpenUiLibraryOptions,
): Library {
  return createLibrary({
    root: options?.root ?? 'Stack',
    components: options?.components
      ? [...DEFAULT_COMPONENTS, ...options.components]
      : DEFAULT_COMPONENTS,
    componentGroups: options?.componentGroups
      ? [...DEFAULT_COMPONENT_GROUPS, ...options.componentGroups]
      : DEFAULT_COMPONENT_GROUPS,
  });
}
