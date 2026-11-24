// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { ComponentInstance, Surface } from './types.js';

/**
 * Bookkeeping the processor keeps next to a surface. It is derived entirely
 * from the surface's components and data, and exists so that an update only
 * has to look at what it can affect.
 *
 * @internal
 */
export interface SurfaceState {
  /**
   * Component definitions exactly as the agent last sent them, by id. A
   * template container keeps its `{ componentId, path }` child list here,
   * while the live instance carries the expanded ids.
   */
  sources: Map<string, ComponentInstance>;
  /** Ids each component refers to through a child slot. */
  references: Map<string, Set<string>>;
  /**
   * Inverse of `references`. It also lists ids that have not arrived yet,
   * which is what lets a parent pick up a child delivered by a later message.
   */
  referrers: Map<string, Set<string>>;
  /** Components whose child slot is a binding or a call, resolved at render. */
  dynamicReferrers: Set<string>;
  /** Ids created by template expansion rather than sent by the agent. */
  generated: Set<string>;
  /** Template containers, with the data path and item keys last expanded. */
  templates: Map<string, { path: string; keys: readonly string[] }>;
  /** Source ids the last expansion asked for, whether or not they existed. */
  templateSources: Set<string>;
  /** Expression errors already reported since the agent last changed this surface. */
  reportedErrors: Set<string>;
}

const states = new WeakMap<Surface, SurfaceState>();

/**
 * Bookkeeping for a surface, created on first use.
 *
 * @internal
 */
export function surfaceState(surface: Surface): SurfaceState {
  let state = states.get(surface);
  if (!state) {
    state = {
      sources: new Map(),
      references: new Map(),
      referrers: new Map(),
      dynamicReferrers: new Set(),
      generated: new Set(),
      templates: new Map(),
      templateSources: new Set(),
      reportedErrors: new Set(),
    };
    states.set(surface, state);
  }
  return state;
}

/**
 * Hand a surface the bookkeeping that was built for an equivalent surface.
 *
 * @internal
 */
export function adoptSurfaceState(target: Surface, source: Surface): void {
  states.set(target, surfaceState(source));
}

/**
 * Record what a component refers to, replacing what was recorded before.
 * Pass `undefined` when the component is removed.
 *
 * @internal
 */
export function indexReferences(
  state: SurfaceState,
  id: string,
  next: { references: Set<string>; dynamic: boolean } | undefined,
): void {
  const previous = state.references.get(id);
  if (previous) {
    for (const childId of previous) {
      if (next?.references.has(childId)) continue;
      const parents = state.referrers.get(childId);
      parents?.delete(id);
      if (parents?.size === 0) state.referrers.delete(childId);
    }
  }
  if (!next) {
    state.references.delete(id);
    state.dynamicReferrers.delete(id);
    return;
  }
  for (const childId of next.references) {
    let parents = state.referrers.get(childId);
    if (!parents) {
      parents = new Set();
      state.referrers.set(childId, parents);
    }
    parents.add(id);
  }
  state.references.set(id, next.references);
  if (next.dynamic) state.dynamicReferrers.add(id);
  else state.dynamicReferrers.delete(id);
}

/**
 * The agent's template child list on a component, if it has one.
 *
 * @internal
 */
export function templateChildren(
  component: ComponentInstance | undefined,
): { componentId: string; path: string } | undefined {
  const children = component?.['children'];
  if (
    children !== null && typeof children === 'object'
    && !Array.isArray(children)
  ) {
    const { componentId, path } = children as Record<string, unknown>;
    if (typeof componentId === 'string' && typeof path === 'string') {
      return { componentId, path };
    }
  }
  return undefined;
}
