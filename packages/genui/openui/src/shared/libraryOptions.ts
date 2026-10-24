// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { ComponentGroup } from '@openuidev/lang-core';

interface LibraryOptions<T> {
  root?: string;
  includeDefaultComponents?: boolean;
  componentNames?: readonly string[];
  components?: T[];
  componentGroups?: ComponentGroup[];
}

/** Assemble the same component contract for headless and renderer libraries. */
export function resolveLibraryOptions<T extends { name: string }>(
  options: LibraryOptions<T> | undefined,
  defaults: {
    components: readonly T[];
    componentGroups: readonly ComponentGroup[];
  },
) {
  const root = options?.root ?? 'Stack';
  const includeDefaults = options?.includeDefaultComponents ?? true;
  const names = options?.componentNames
    ? new Set([...options.componentNames, root])
    : undefined;
  const components = includeDefaults
    ? defaults.components.filter(component =>
      !names || names.has(component.name)
    )
    : [];
  const groups = includeDefaults
    ? defaults.componentGroups.map(group => ({
      ...group,
      components: group.components.filter(name => !names || names.has(name)),
    })).filter(group => !names || group.components.length > 0)
    : undefined;
  const componentGroups = groups
    ? [...groups, ...(options?.componentGroups ?? [])]
    : options?.componentGroups;

  return {
    root,
    components: [...components, ...(options?.components ?? [])],
    ...(componentGroups ? { componentGroups } : {}),
  };
}
