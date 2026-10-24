// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export const JEV_MAX_DEPTH = 8;
export const JEV_MAX_COMPONENTS = 64;

export const JEV_STRUCTURAL_PROPS = new Set([
  'children',
  'child',
  'buttons',
  'tabs',
  'trigger',
  'content',
]);

export type JevComponent =
  & { id: string; component: string }
  & Record<string, unknown>;

export interface JevCandidate {
  id: string;
  description: string;
  component: JevComponent;
  parent?: string;
  movable: boolean;
  acceptsChildren: boolean;
  allowedChildren?: readonly string[];
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Read normalized child references, including named slots and repeating templates. */
export function jevChildIds(component: JevComponent): string[] {
  const refs: unknown[] = [
    component.child,
    component.trigger,
    component.content,
  ];
  if (Array.isArray(component.children)) {
    refs.push(...(component.children as unknown[]));
  }
  if (isRecord(component.children)) {
    refs.push(component.children.componentId);
    if (isRecord(component.children.template)) {
      refs.push(component.children.template.componentId);
    }
  }
  if (Array.isArray(component.tabs)) {
    for (const tab of component.tabs) if (isRecord(tab)) refs.push(tab.child);
  }
  return refs.filter((ref): ref is string => typeof ref === 'string');
}

/** Describe and validate a concrete component tree, including named and repeating slots. */
export function describeJevComponents(
  components: JevComponent[],
): JevCandidate[] {
  if (components.length > JEV_MAX_COMPONENTS) {
    throw new Error('Jev composition exceeds the 64-component limit.');
  }
  const byId = new Map(
    components.map(component => [component.id, component]),
  );
  const parents = new Map<string, string>();
  const templateScope = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string, path: Set<string>, inTemplate: boolean) => {
    if (path.has(id)) throw new Error('Jev selected a cyclic layout.');
    if (path.size >= JEV_MAX_DEPTH) {
      throw new Error('Jev layout exceeds the depth limit.');
    }
    if (visited.has(id)) {
      throw new Error('Jev components must have exactly one parent.');
    }
    const component = byId.get(id);
    if (!component) throw new Error('Jev selected a missing child component.');
    visited.add(id);
    if (inTemplate) templateScope.add(id);
    const next = new Set(path).add(id);
    for (const child of jevChildIds(component)) {
      parents.set(child, id);
      visit(child, next, inTemplate || isRecord(component.children));
    }
  };
  visit('root', new Set(), false);
  if (visited.size !== components.length) {
    const unreachable = components.filter(component =>
      !visited.has(component.id)
    );
    throw new Error(
      `Jev composition contains unreachable components: ${
        unreachable.map(component => component.id).join(', ')
      }.`,
    );
  }
  return components.map(component => {
    const parent = parents.get(component.id);
    const parentComponent = parent === undefined ? undefined : byId.get(parent);
    // Only display copy is shared with Jev, never input values, bindings, or raw state.
    const copy = ['text', 'label', 'title', 'variant'].flatMap(key =>
      typeof component[key] === 'string'
        ? [`${key}: ${JSON.stringify(component[key])}`]
        : []
    ).join('; ').slice(0, 1000);
    return {
      id: component.id,
      component,
      description: `${component.component}${copy ? ` (${copy})` : ''}`,
      ...(parent === undefined ? {} : { parent }),
      movable: !templateScope.has(component.id)
        && Array.isArray(parentComponent?.children),
      acceptsChildren: !templateScope.has(component.id)
        && Array.isArray(component.children),
    };
  });
}
