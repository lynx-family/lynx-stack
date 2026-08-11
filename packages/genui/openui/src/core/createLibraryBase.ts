// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createLibrary } from './library.jsx';
import type { ComponentGroup, DefinedComponent, Library } from './library.jsx';

/** Options for creating a ReactLynx OpenUI component library. */
export interface CreateOpenUiLibraryOptions {
  /** Override the root component name. Defaults to `'Stack'`. */
  root?: string;
  /**
   * Whether to include the built-in components and component groups.
   * Defaults to `true`.
   */
  includeDefaultComponents?: boolean;
  /** Additional components, or the complete set when defaults are disabled. */
  components?: DefinedComponent<any>[];
  /** Additional groups, or the complete set when defaults are disabled. */
  componentGroups?: ComponentGroup[];
}

interface OpenUiLibraryDefaults {
  components: readonly DefinedComponent<any>[];
  componentGroups: readonly ComponentGroup[];
}

/** @internal */
export function createOpenUiLibraryWithDefaults(
  options: CreateOpenUiLibraryOptions | undefined,
  defaults: OpenUiLibraryDefaults,
): Library {
  const includeDefaultComponents = options?.includeDefaultComponents ?? true;
  const componentGroups = includeDefaultComponents
    ? [...defaults.componentGroups, ...(options?.componentGroups ?? [])]
    : options?.componentGroups;

  return createLibrary({
    root: options?.root ?? 'Stack',
    components: includeDefaultComponents
      ? [...defaults.components, ...(options?.components ?? [])]
      : (options?.components ?? []),
    ...(componentGroups ? { componentGroups } : {}),
  });
}
