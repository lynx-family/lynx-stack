// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createLibrary } from './library.jsx';
import type { ComponentGroup, DefinedComponent, Library } from './library.jsx';
import { resolveLibraryOptions } from '../shared/libraryOptions.js';

/** Options for creating a ReactLynx OpenUI component library. */
export interface CreateOpenUiLibraryOptions {
  /**
   * Root component name; supply its definition when defaults are disabled.
   * @defaultValue `'Stack'`
   */
  root?: string;
  /**
   * Whether to include the built-in components and component groups.
   * @defaultValue `true`
   */
  includeDefaultComponents?: boolean;
  /**
   * Limit built-ins to these names, retaining the selected root automatically.
   * Custom components are always appended. Ignored when defaults are disabled.
   * @defaultValue All built-in components.
   * @example `componentNames: ['Stack', 'Text']`
   */
  componentNames?: readonly string[];
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
  return createLibrary(resolveLibraryOptions(options, defaults));
}
