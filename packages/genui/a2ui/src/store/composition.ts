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
    const sink: ReferenceSink = { refs: new Set(), dynamic: false };
    collect(parent, schemaFor(parent), sink);
    for (const id of sink.refs) {
      const child = components.get(id);
      if (child) edge(parent, child);
    }
  }
  return errors;
}

/** A child slot whose value is computed at render time. */
function isDynamic(value: unknown): boolean {
  return value !== null && typeof value === 'object'
    && (typeof (value as Record<string, unknown>)['@path'] === 'string'
      || typeof (value as Record<string, unknown>)['@call'] === 'string');
}

interface ReferenceSink {
  refs: Set<string>;
  /** Set when a child slot holds a binding or a call instead of an id. */
  dynamic: boolean;
}

function collect(
  value: unknown,
  schema: unknown,
  sink: ReferenceSink,
  includeAlternatives = false,
): void {
  if (!schema || typeof schema !== 'object') return;
  const node = schema as Record<string, unknown>;
  if (includeAlternatives) {
    for (const keyword of ['anyOf', 'oneOf', 'allOf']) {
      const alternatives = node[keyword];
      if (Array.isArray(alternatives)) {
        for (const branch of alternatives) collect(value, branch, sink, true);
      }
    }
  }
  const ref = typeof node['$ref'] === 'string' ? node['$ref'] : '';
  if (ref.endsWith('/ComponentId')) {
    if (typeof value === 'string') sink.refs.add(value);
    else if (isDynamic(value)) sink.dynamic = true;
  } else if (ref.endsWith('/ChildList')) {
    if (Array.isArray(value)) {
      for (const id of value) if (typeof id === 'string') sink.refs.add(id);
    } else if (
      value && typeof value === 'object' && 'componentId' in value
      && typeof value.componentId === 'string'
    ) sink.refs.add(value.componentId);
    else if (isDynamic(value)) sink.dynamic = true;
  } else if (Array.isArray(value)) {
    for (const item of value) {
      collect(item, node['items'], sink, includeAlternatives);
    }
  } else if (value && typeof value === 'object') {
    const properties = node['properties'] as
      | Record<string, unknown>
      | undefined;
    for (const [key, item] of Object.entries(value)) {
      collect(item, properties?.[key], sink, includeAlternatives);
    }
  }
}

/**
 * Describe what a component refers to through its child slots, falling back
 * to the built-in child fields when its catalog has no schema. Literal text
 * and metadata are not references.
 *
 * @internal
 */
export function describeComponentReferences(
  component: ComponentInstance,
  schema: Record<string, unknown> | undefined,
): { references: Set<string>; dynamic: boolean } {
  const sink: ReferenceSink = { refs: new Set(), dynamic: false };
  if (schema) {
    collect(component, schema, sink, true);
  } else {
    const children = component['children'];
    if (Array.isArray(children)) {
      for (const id of children) if (typeof id === 'string') sink.refs.add(id);
    } else if (
      children && typeof children === 'object' && 'componentId' in children
      && typeof children.componentId === 'string'
    ) sink.refs.add(children.componentId);
    for (const key of ['child', 'trigger', 'content']) {
      const id = component[key];
      if (typeof id === 'string') sink.refs.add(id);
      else if (isDynamic(id)) sink.dynamic = true;
    }
    const tabs = component['tabs'];
    if (Array.isArray(tabs)) {
      for (const tab of tabs as unknown[]) {
        if (tab && typeof tab === 'object' && 'child' in tab) {
          if (typeof tab.child === 'string') sink.refs.add(tab.child);
          else if (isDynamic(tab.child)) sink.dynamic = true;
        }
      }
    }
  }
  if (component.__template) sink.refs.add(component.__template.componentId);
  return { references: sink.refs, dynamic: sink.dynamic };
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
  return describeComponentReferences(component, schema).references;
}
