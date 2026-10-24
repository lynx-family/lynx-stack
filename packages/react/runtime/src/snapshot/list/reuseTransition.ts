// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { nestedListBridge } from '../../worklet-runtime/listEvent.js';
import type { SnapshotInstance } from '../snapshot/snapshot.js';

// Lynx tools/css_generator/css_defines/110-transition-property.json (also web-core CSSPropertyType).
const TRANSITION_PROPERTY_ID = 110;
const elementRestores = new Map<number, () => void>();
const pendingCancels = new Set<() => void>();
const bindingSnapshots = new Set<SnapshotInstance>();

interface ReuseTransitionBinding {
  restore: () => void;
  finish: () => void;
}

/** Public MTS style updates must not be overwritten by deferred restoration. */
export function restoreReusedElementStyle(element: FiberElement): void {
  if (elementRestores.size) elementRestores.get(__GetElementUniqueID(element))?.();
}

export function clearReuseTransitions(): void {
  for (const cancel of pendingCancels) cancel();
}

/** Ordinary updates end any pending rebind suppression before changing styles. */
export function restoreReuseTransition(snapshot: SnapshotInstance): void {
  if (!pendingCancels.size) return;
  let current: SnapshotInstance | null = snapshot;
  while (current) {
    // Native nested-list callbacks can hydrate descendants synchronously while
    // the containing row's bind is still committing. They are part of that
    // bind, not a later update that should end transition suppression.
    if (!bindingSnapshots.has(current)) {
      current.__restoreReuseTransition?.();
    }
    current = current.parentNode;
  }
}

/** Keep suppression through the existing native bind, without an extra flush. */
export function prepareReuseTransition(snapshot: SnapshotInstance): ReuseTransitionBinding | undefined {
  if (typeof __GetInlineStyle !== 'function' || typeof __GetInlineStyles !== 'function') return;
  const styles: { element: FiberElement; id: number; property: unknown; raw: string }[] = [];
  const visit = (element: FiberElement): void => {
    const tag = __GetTag(element);
    if (tag !== 'raw-text') {
      const raw = __GetInlineStyles(element);
      styles.push({
        element,
        id: __GetElementUniqueID(element),
        raw,
        property: __GetInlineStyle(element, TRANSITION_PROPERTY_ID),
      });
      if (raw) __SetInlineStyles(element, `${raw};transition-property:none !important;`);
      else __AddInlineStyle(element, TRANSITION_PROPERTY_ID, 'none');
    }
    // Nested cells have independent owners and independent bind transactions.
    if (tag === 'list') return;
    let child = __FirstElement(element);
    while (child) {
      visit(child);
      child = __NextElement(child);
    }
  };
  visit(snapshot.__element_root!);
  const settle = (restoreStyles: boolean): void => {
    if (snapshot.__restoreReuseTransition !== restore) return;
    snapshot.__restoreReuseTransition = undefined;
    bindingSnapshots.delete(snapshot);
    pendingCancels.delete(cancel);
    for (const { element, id, property, raw } of styles) {
      elementRestores.delete(id);
      if (restoreStyles) {
        if (raw) __SetInlineStyles(element, raw);
        else __AddInlineStyle(element, TRANSITION_PROPERTY_ID, property ?? null);
      }
    }
    styles.length = 0;
  };
  const restore = (): void => settle(true);
  const cancel = (): void => settle(false);
  snapshot.__restoreReuseTransition = restore;
  bindingSnapshots.add(snapshot);
  pendingCancels.add(cancel);
  // Public MTS style writes may come from a separately bundled worklet runtime.
  nestedListBridge().restoreStyle ??= restoreReusedElementStyle;
  for (const { id } of styles) elementRestores.set(id, restore);
  return {
    restore,
    finish: () => {
      bindingSnapshots.delete(snapshot);
    },
  };
}
