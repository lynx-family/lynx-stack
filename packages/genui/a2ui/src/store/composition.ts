// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { ComponentInstance } from './types.js';
import type { Catalog } from '../catalog/defineCatalog.js';

/** Evaluate catalog composition constraints, including the implicit Surface parent. */
export function compositionErrors(
  components: ReadonlyMap<string, ComponentInstance>,
  defaultCatalogId: string | undefined,
  getCatalog: (id: string | undefined) => Catalog | undefined,
): { code: string; path: string; message: string }[] {
  const errors: { code: string; path: string; message: string }[] = [];
  const schemaFor = (component: ComponentInstance) =>
    getCatalog(component['@catalogId'] ?? defaultCatalogId)
      ?.components.find(entry => entry.name === component.component)?.schema;
  const edge = (
    parent: ComponentInstance | undefined,
    child: ComponentInstance,
  ) => {
    const parentType = parent?.component ?? 'Surface';
    const parents = schemaFor(child)?.['allowedParents'];
    const children = parent
      ? schemaFor(parent)?.['allowedChildren']
      : undefined;
    if (Array.isArray(parents) && !parents.includes(parentType)) {
      errors.push({
        code: 'UNALLOWED_PARENT',
        path: `/components/${child.id}`,
        message: `${child.component} cannot be a child of ${parentType}`,
      });
    }
    if (Array.isArray(children) && !children.includes(child.component)) {
      errors.push({
        code: 'UNALLOWED_CHILD',
        path: `/components/${child.id}`,
        message: `${parentType} cannot contain ${child.component}`,
      });
    }
  };
  const root = components.get('root');
  if (root) edge(undefined, root);
  for (const parent of components.values()) {
    const refs = new Set<string>();
    collect(parent, schemaFor(parent), refs);
    for (const id of refs) {
      const child = components.get(id);
      if (child) edge(parent, child);
    }
  }
  return errors;
}

function collect(
  value: unknown,
  schema: unknown,
  refs: Set<string>,
  includeAlternatives = false,
): void {
  if (!schema || typeof schema !== 'object') return;
  const node = schema as Record<string, unknown>;
  if (includeAlternatives) {
    for (const keyword of ['anyOf', 'oneOf', 'allOf']) {
      const alternatives = node[keyword];
      if (Array.isArray(alternatives)) {
        for (const branch of alternatives) collect(value, branch, refs, true);
      }
    }
  }
  const ref = typeof node['$ref'] === 'string' ? node['$ref'] : '';
  if (ref.endsWith('/ComponentId') && typeof value === 'string') {
    refs.add(value);
  } else if (ref.endsWith('/ChildList')) {
    if (Array.isArray(value)) {
      for (const id of value) if (typeof id === 'string') refs.add(id);
    } else if (
      value && typeof value === 'object' && 'componentId' in value
      && typeof value.componentId === 'string'
    ) refs.add(value.componentId);
  } else if (Array.isArray(value)) {
    for (const item of value) {
      collect(item, node['items'], refs, includeAlternatives);
    }
  } else if (value && typeof value === 'object') {
    const properties = node['properties'] as
      | Record<string, unknown>
      | undefined;
    for (const [key, item] of Object.entries(value)) {
      collect(item, properties?.[key], refs, includeAlternatives);
    }
  }
}

/**
 * Collect declared component references, falling back to built-in child fields
 * when a catalog has no schema. Literal text and metadata are not references.
 *
 * @internal
 */
export function collectComponentReferences(
  component: ComponentInstance,
  schema: Record<string, unknown> | undefined,
): Set<string> {
  const refs = new Set<string>();
  if (schema) {
    collect(component, schema, refs, true);
  } else {
    const children = component['children'];
    if (Array.isArray(children)) {
      for (const id of children) if (typeof id === 'string') refs.add(id);
    } else if (
      children && typeof children === 'object' && 'componentId' in children
      && typeof children.componentId === 'string'
    ) refs.add(children.componentId);
    for (const key of ['child', 'trigger', 'content']) {
      const id = component[key];
      if (typeof id === 'string') refs.add(id);
    }
    const tabs = component['tabs'];
    if (Array.isArray(tabs)) {
      for (const tab of tabs as unknown[]) {
        if (
          tab && typeof tab === 'object' && 'child' in tab
          && typeof tab.child === 'string'
        ) refs.add(tab.child);
      }
    }
  }
  if (component.__template) refs.add(component.__template.componentId);
  return refs;
}
