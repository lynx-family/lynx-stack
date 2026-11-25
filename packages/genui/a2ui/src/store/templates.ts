// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { escapePointerSegment, readDataModel } from './protocol.js';
import { createResource } from './Resource.js';
import { templateChildren } from './surfaceState.js';
import type { SurfaceState } from './surfaceState.js';
import type { ComponentInstance, Surface } from './types.js';
import { equalJsonValues, isObject } from './utils.js';

/**
 * What template expansion needs from the processor that owns the surface.
 *
 * @internal
 */
export interface TemplateHost {
  resolvePath(path: string, dataContextPath?: string): string;
  /** Called after an instance is stored (`instance`) or removed (`undefined`). */
  index(
    surface: Surface,
    id: string,
    instance: ComponentInstance | undefined,
  ): void;
}

/** The item keys a template is instantiated for, in rendering order. */
function itemKeys(data: unknown): string[] {
  let value = data;
  if (typeof value === 'string') {
    try {
      value = value ? JSON.parse(value) as unknown : undefined;
    } catch {
      value = undefined;
    }
  }
  if (Array.isArray(value)) {
    const keys: string[] = [];
    value.forEach((_, index) => keys.push(String(index)));
    return keys;
  }
  return isObject(value) ? Object.keys(value) : [];
}

function sameKeys(a: unknown, b: readonly string[]): boolean {
  return Array.isArray(a) && a.length === b.length
    && a.every((key, index) => key === b[index]);
}

/**
 * Whether a parent has to render again because of a change to one of its
 * children. A child renders its own changes; its parent only needs to know
 * when the child appears, or when a prop the parent lays it out by changes.
 *
 * @internal
 */
export function affectsParent(
  previous: ComponentInstance | undefined,
  next: ComponentInstance,
): boolean {
  return !previous || previous.weight !== next.weight
    || previous.component !== next.component;
}

/**
 * Whether any template would expand to a different set of items than it did
 * last time. Changing a value inside an item does not make a template stale:
 * an instance reads its data through its data context path.
 *
 * @internal
 */
export function templatesAreStale(
  surface: Surface,
  state: SurfaceState,
): boolean {
  const model = surface.store.getDataModel();
  for (const { path, keys } of state.templates.values()) {
    if (!sameKeys(itemKeys(readDataModel(model, path)), keys)) return true;
  }
  return false;
}

/**
 * Bring a surface's template instances in line with its component
 * definitions and data.
 *
 * A template container `{ componentId, path }` gets one copy of the template
 * subtree per item at `path`. Copies are named `<id>:<key>`, carry the
 * item's data context path, and may themselves be template containers, in
 * which case their path is resolved inside the item and their copies are
 * named `<id>:<key>:<innerKey>`.
 *
 * Instances that would come out identical are kept as they are, so their
 * resources are not notified. Instances whose item is gone are removed
 * together with their resources.
 *
 * @returns The instances that changed: each container followed by its new
 * or changed copies, parents before children.
 *
 * @internal
 */
export function expandTemplates(
  surface: Surface,
  state: SurfaceState,
  host: TemplateHost,
): ComponentInstance[] {
  const model = surface.store.getDataModel();
  const desired = new Map<string, ComponentInstance>();
  const templates: SurfaceState['templates'] = new Map();
  const sources = new Set<string>();
  let created: string[] = [];

  const expand = (
    containerId: string,
    template: { componentId: string; path: string },
    suffix: string,
  ): string[] => {
    const keys = itemKeys(readDataModel(model, template.path));
    templates.set(containerId, { path: template.path, keys });
    const base = template.path === '/' ? '' : template.path;
    const children: string[] = [];
    for (const key of keys) {
      const id = clone(
        template.componentId,
        `${suffix}:${key}`,
        `${base}/${escapePointerSegment(key)}`,
      );
      if (id) children.push(id);
    }
    return children;
  };

  const clone = (
    sourceId: string,
    suffix: string,
    dataContextPath: string,
  ): string | null => {
    // Recorded even when missing, so its arrival triggers a new expansion.
    sources.add(sourceId);
    const source = state.sources.get(sourceId);
    if (!source) return null;
    const id = `${sourceId}${suffix}`;
    // A subtree that reaches the same component twice shares one copy, and a
    // subtree that refers back to itself stops here.
    if (desired.has(id)) return id;

    const copy = JSON.parse(JSON.stringify(source)) as ComponentInstance;
    copy.id = id;
    copy.dataContextPath = dataContextPath;
    desired.set(id, copy);
    created.push(id);

    const reference = (childId: unknown): string | null =>
      typeof childId === 'string'
        ? clone(childId, suffix, dataContextPath)
        : null;

    const nested = templateChildren(copy);
    if (nested) {
      copy.__template = {
        componentId: nested.componentId,
        path: host.resolvePath(nested.path, dataContextPath),
      };
      copy['children'] = expand(id, copy.__template, suffix);
    } else if (Array.isArray(copy['children'])) {
      const children: string[] = [];
      for (const childId of copy['children'] as unknown[]) {
        const next = reference(childId);
        if (next) children.push(next);
      }
      copy['children'] = children;
    }
    for (const field of ['child', 'trigger', 'content']) {
      const next = reference(copy[field]);
      if (next) copy[field] = next;
    }
    if (Array.isArray(copy['tabs'])) {
      copy['tabs'] = (copy['tabs'] as unknown[]).map(tab => {
        if (!isObject(tab)) return tab;
        const next = reference(tab['child']);
        return next ? { ...tab, child: next } : tab;
      });
    }
    return id;
  };

  const plans: { id: string; children: string[]; created: string[] }[] = [];
  for (const [id, source] of state.sources) {
    const template = templateChildren(source);
    const container = surface.components.get(id);
    if (!template || !container) continue;
    created = [];
    const children = expand(id, {
      componentId: template.componentId,
      path: container.__template?.path
        ?? host.resolvePath(template.path, container.dataContextPath),
    }, '');
    plans.push({ id, children, created });
  }

  const updates: ComponentInstance[] = [];
  const updated = new Set<string>();
  const parentsToNotify: string[] = [];
  for (const plan of plans) {
    const container = surface.components.get(plan.id)!;
    if (!sameKeys(container['children'], plan.children)) {
      // A new object, never an in-place edit: readers compare instances by
      // identity to decide whether anything changed.
      const next = { ...container, children: plan.children };
      surface.components.set(plan.id, next);
      host.index(surface, plan.id, next);
      updates.push(next);
      updated.add(plan.id);
    }
    for (const id of plan.created) {
      const copy = desired.get(id)!;
      const existing = surface.components.get(id);
      if (
        existing && state.generated.has(id) && equalJsonValues(existing, copy)
      ) {
        continue;
      }
      surface.components.set(id, copy);
      if (!surface.resources.has(id)) {
        surface.resources.set(id, createResource(id));
      }
      state.generated.add(id);
      host.index(surface, id, copy);
      updates.push(copy);
      updated.add(id);
      if (affectsParent(existing, copy)) parentsToNotify.push(id);
    }
  }

  for (const id of [...state.generated]) {
    if (desired.has(id)) continue;
    state.generated.delete(id);
    surface.components.delete(id);
    surface.resources.delete(id);
    host.index(surface, id, undefined);
  }

  for (const id of parentsToNotify) {
    for (const parentId of state.referrers.get(id) ?? []) {
      const parent = surface.components.get(parentId);
      if (parent && !updated.has(parentId)) {
        updated.add(parentId);
        updates.push(parent);
      }
    }
  }

  state.templates = templates;
  state.templateSources = sources;
  return updates;
}
