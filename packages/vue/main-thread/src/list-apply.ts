// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * List element management for the Main Thread ops executor.
 *
 * Native <list> elements must be created via __CreateList with callbacks.
 * The native list calls componentAtIndex(list, listID, cellIndex, operationID)
 * when it needs to render an item. We collect items as they're inserted and
 * provide them via the callback.
 */

import { elements } from './element-registry.js';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/** Per-list state: ordered list of child elements that the native list can request */
interface ListItemEntry {
  el: LynxElement;
  bgId: number;
}
const listItems = new Map<number, ListItemEntry[]>();

/** Set of BG-thread element IDs that are <list> elements */
const listElementIds = new Set<number>();

/** item-key values per bg element ID (for list-item children) */
const itemKeyMap = new Map<number, string>();

/**
 * Platform info attributes for list items — these must go ONLY into
 * update-list-info's insertAction, NOT via __SetAttribute on the native element.
 * Setting them both ways causes the native list to count items twice.
 * (Matches React Lynx's platformInfoAttributes in snapshot/platformInfo.ts)
 */
const PLATFORM_INFO_ATTRS = new Set([
  'item-key',
  'estimated-main-axis-size-px',
  'estimated-height-px',
  'estimated-height',
  'reuse-identifier',
  'full-span',
  'sticky-top',
  'sticky-bottom',
  'recyclable',
]);

/** Per list-item bg ID -> platform info attributes (for update-list-info) */
const listItemPlatformInfo = new Map<number, Record<string, unknown>>();

/** How many items have already been reported via update-list-info per list */
const listItemsReported = new Map<number, number>();

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** No-op: Vue manages all items; no recycling needed. */
// biome-ignore lint/suspicious/noEmptyBlockStatements: intentional no-op
function enqueueComponentNoop(): void {}

function createListCallbacks(bgId: number): {
  componentAtIndex: (
    list: LynxElement,
    listID: number,
    cellIndex: number,
    operationID: number,
  ) => number | undefined;
  enqueueComponent: (...args: unknown[]) => void;
  componentAtIndexes: (
    list: LynxElement,
    listID: number,
    cellIndexes: number[],
    operationIDs: number[],
  ) => void;
} {
  const componentAtIndex = (
    list: LynxElement,
    listID: number,
    cellIndex: number,
    operationID: number,
  ): number | undefined => {
    const items = listItems.get(bgId);
    if (!items || cellIndex < 0 || cellIndex >= items.length) return undefined;
    const item = items[cellIndex]!.el;
    __AppendElement(list, item);
    const sign = __GetElementUniqueID(item);
    __FlushElementTree(item, {
      triggerLayout: true,
      operationID,
      elementID: sign,
      listID,
    });
    return sign;
  };

  const enqueueComponent = enqueueComponentNoop;

  const componentAtIndexes = (
    list: LynxElement,
    listID: number,
    cellIndexes: number[],
    operationIDs: number[],
  ): void => {
    const items = listItems.get(bgId);
    if (!items) return;
    const elementIDs: number[] = [];
    for (let j = 0; j < cellIndexes.length; j++) {
      const cellIndex = cellIndexes[j]!;
      const _operationID = operationIDs[j]!;
      if (cellIndex < 0 || cellIndex >= items.length) {
        elementIDs.push(-1);
        continue;
      }
      const item = items[cellIndex]!.el;
      __AppendElement(list, item);
      const sign = __GetElementUniqueID(item);
      elementIDs.push(sign);
    }
    __FlushElementTree(list, {
      triggerLayout: true,
      operationIDs,
      elementIDs,
      listID,
    });
  };

  return { componentAtIndex, enqueueComponent, componentAtIndexes };
}

// ---------------------------------------------------------------------------
// Public API (called from ops-apply.ts switch cases)
// ---------------------------------------------------------------------------

/** Check if a parent element ID is a <list> element */
export function isListParent(parentId: number): boolean {
  return listElementIds.has(parentId);
}

/** Check if a prop key is a platform-info attribute for list items */
export function isPlatformInfoAttr(key: string): boolean {
  return PLATFORM_INFO_ATTRS.has(key);
}

/** CREATE case: create a native <list> element and set up tracking state */
export function createListElement(id: number): LynxElement {
  listElementIds.add(id);
  listItems.set(id, []);
  listItemsReported.set(id, 0);
  const cbs = createListCallbacks(id);
  const el = __CreateList(
    0,
    cbs.componentAtIndex,
    cbs.enqueueComponent,
    {},
    cbs.componentAtIndexes,
  );
  __SetCSSId([el], 0);
  return el;
}

/** INSERT case: collect a child into a <list> parent's item array */
export function insertListItem(
  parentId: number,
  child: LynxElement,
  childId: number,
): void {
  const items = listItems.get(parentId);
  if (items) items.push({ el: child, bgId: childId });
}

/** SET_PROP case: store a platform-info attribute for a list item */
export function setPlatformInfoProp(
  id: number,
  key: string,
  value: unknown,
): void {
  const info = listItemPlatformInfo.get(id);
  if (info) {
    info[key] = value;
  } else {
    listItemPlatformInfo.set(id, { [key]: value });
  }
  if (key === 'item-key') itemKeyMap.set(id, String(value));
}

/**
 * Post-ops flush: for any <list> elements with newly-inserted items, tell the
 * native list via the 'update-list-info' attribute. Only send items added since
 * the last applyOps call to avoid "duplicated item-key" errors.
 */
export function flushListUpdates(): void {
  for (const [bgId, items] of listItems) {
    const reported = listItemsReported.get(bgId) ?? 0;
    if (items.length <= reported) continue;
    const listEl = elements.get(bgId);
    if (!listEl) continue;
    const insertAction: Record<string, unknown>[] = [];
    for (let j = reported; j < items.length; j++) {
      const entry = items[j]!;
      const action: Record<string, unknown> = {
        position: j,
        type: 'list-item',
        'item-key': itemKeyMap.get(entry.bgId) ?? String(j),
      };
      // Merge any collected platform info attributes into the action
      const pInfo = listItemPlatformInfo.get(entry.bgId);
      if (pInfo) Object.assign(action, pInfo);
      insertAction.push(action);
    }
    __SetAttribute(listEl, 'update-list-info', {
      insertAction,
      removeAction: [],
      updateAction: [],
    });
    listItemsReported.set(bgId, items.length);
  }
}

/** Reset all list state — for testing only. */
export function resetListState(): void {
  listItems.clear();
  listElementIds.clear();
  itemKeyMap.clear();
  listItemPlatformInfo.clear();
  listItemsReported.clear();
}
