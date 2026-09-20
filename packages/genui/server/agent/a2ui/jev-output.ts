// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describeJevTree, isRecord, jevChildIds } from './jev-candidates.js';
import type { JevComponent, JevContent } from './jev-candidates.js';

/** Prior model output cannot authorize an embedded app when the host supplies no resource. */
export function omitUnhostedJevMcpApps(
  content: JevContent,
): JevContent | undefined {
  if (!content.components.some(component => component.component === 'McpApp')) {
    return content;
  }
  describeJevTree(content);
  const removed = new Set(
    content.components.filter(component => component.component === 'McpApp')
      .map(component => component.id),
  );
  // Remove owners that would otherwise retain a dangling required child/slot.
  let changed = true;
  while (changed) {
    changed = false;
    for (const component of content.components) {
      if (removed.has(component.id)) continue;
      const requiredChildren: unknown[] = [
        component.child,
        component.trigger,
        component.content,
      ];
      if (isRecord(component.children)) {
        requiredChildren.push(...jevChildIds(component));
      }
      const emptyTabs = Array.isArray(component.tabs)
        && component.tabs.length > 0
        && component.tabs.every(tab =>
          isRecord(tab) && typeof tab.child === 'string'
          && removed.has(tab.child)
        );
      if (
        emptyTabs
        || requiredChildren.some(id =>
          typeof id === 'string' && removed.has(id)
        )
      ) {
        removed.add(component.id);
        changed = true;
      }
    }
  }
  if (removed.has('root')) return undefined;
  const remaining = content.components.filter(component =>
    !removed.has(component.id)
  ).map(component => ({
    ...component,
    ...(Array.isArray(component.children)
      ? {
        children: (component.children as string[]).filter(id =>
          !removed.has(id)
        ),
      }
      : {}),
    ...(Array.isArray(component.tabs)
      ? {
        tabs: component.tabs.filter(tab =>
          isRecord(tab) && !removed.has(String(tab.child))
        ),
      }
      : {}),
  }));
  const byId = new Map(remaining.map(component => [component.id, component]));
  const reachable = new Set<string>();
  const visit = (id: string) => {
    reachable.add(id);
    for (const child of jevChildIds(byId.get(id)!)) visit(child);
  };
  visit('root');
  return {
    ...content,
    components: remaining.filter(component => reachable.has(component.id)),
  };
}

/** Remove redundant new display nodes without changing existing or bound content. */
export function cleanJevSnapshot(
  content: JevContent,
  existingIds: ReadonlySet<string>,
  pruneEmpty: boolean,
): JevComponent[] {
  const tree = describeJevTree(content);
  const byId = new Map(tree.map(item => [item.id, item]));
  const removed = new Set<string>();
  const fingerprint = (id: string): string | undefined => {
    const item = byId.get(id)!;
    const component = item.component;
    if (
      !item.movable || component.component !== 'Text'
      || typeof component.text !== 'string' || component.action !== undefined
      || jevChildIds(component).length > 0
    ) return undefined;
    return JSON.stringify(Object.fromEntries(
      Object.entries(component).filter(([key]) => key !== 'id')
        .sort(([left], [right]) => left.localeCompare(right)),
    ));
  };
  for (const item of tree) {
    if (!Array.isArray(item.component.children)) continue;
    const children = item.component.children as string[];
    const seen = new Set(
      children.filter(id => existingIds.has(id))
        .map(id => fingerprint(id)).filter(value => value !== undefined),
    );
    for (const id of children) {
      if (existingIds.has(id)) continue;
      const key = fingerprint(id);
      if (key === undefined) continue;
      if (seen.has(key)) removed.add(id);
      else seen.add(key);
    }
  }
  if (pruneEmpty) {
    const hasContent = (id: string): boolean => {
      if (removed.has(id)) return false;
      if (existingIds.has(id)) return true;
      const component = byId.get(id)!.component;
      if (Array.isArray(component.children)) {
        return (component.children as string[]).some(child =>
          hasContent(child)
        );
      }
      if (typeof component.child === 'string') {
        return hasContent(component.child);
      }
      if (typeof component.content === 'string') {
        return hasContent(component.content);
      }
      if (Array.isArray(component.tabs)) {
        return component.tabs.some(tab =>
          isRecord(tab) && typeof tab.child === 'string'
          && hasContent(tab.child)
        );
      }
      // Keep repeating scopes, bindings and leaf components intact.
      return true;
    };
    const removeSubtree = (id: string) => {
      removed.add(id);
      for (const child of jevChildIds(byId.get(id)!.component)) {
        removeSubtree(child);
      }
    };
    for (const item of tree) {
      if (item.movable && !existingIds.has(item.id) && !hasContent(item.id)) {
        removeSubtree(item.id);
      }
    }
  }
  return content.components.filter(component => !removed.has(component.id))
    .map(component =>
      Array.isArray(component.children)
        ? {
          ...component,
          children: (component.children as string[]).filter(id =>
            !removed.has(id)
          ),
        }
        : component
    );
}
