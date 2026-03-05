// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Main Thread ops executor.
 *
 * Receives the flat-array ops buffer sent by the Background Thread via
 * callLepusMethod('vuePatchUpdate', { data: JSON.stringify(ops) }) and applies
 * each operation using Lynx PAPI.
 *
 * Op format mirrors packages/vue/runtime/src/ops.ts – keep in sync.
 */

// Op codes (mirrored from runtime/ops.ts – must stay in sync)
const OP = {
  CREATE: 0,
  CREATE_TEXT: 1,
  INSERT: 2,
  REMOVE: 3,
  SET_PROP: 4,
  SET_TEXT: 5,
  SET_EVENT: 6,
  REMOVE_EVENT: 7,
  SET_STYLE: 8,
  SET_CLASS: 9,
  SET_ID: 10,
  SET_WORKLET_EVENT: 11,
  SET_MT_REF: 12,
} as const;

/** Map from BG-thread ShadowElement id → Lynx Main Thread element handle */
const elements = new Map<number, LynxElement>();

// ---------------------------------------------------------------------------
// List element management
//
// Native <list> elements must be created via __CreateList with callbacks.
// The native list calls componentAtIndex(list, listID, cellIndex, operationID)
// when it needs to render an item. We collect items as they're inserted and
// provide them via the callback.
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

/** Per list-item bg ID → platform info attributes (for update-list-info) */
const listItemPlatformInfo = new Map<number, Record<string, unknown>>();

/** How many items have already been reported via update-list-info per list */
const listItemsReported = new Map<number, number>();

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

export function applyOps(ops: unknown[]): void {
  const len = ops.length;
  if (len === 0) return;

  // Detect duplicate batch from double BG bundle evaluation.
  // Each __init_card_bundle__ invocation gets a fresh webpack module cache, so
  // ShadowElement.nextId resets to 2, producing the same element IDs.
  // If the first CREATE op targets an ID that already exists in our elements Map,
  // this is a duplicate batch — skip it entirely.
  if (len >= 3 && ops[0] === OP.CREATE) {
    const firstId = ops[1] as number;
    if (elements.has(firstId)) {
      return;
    }
  }

  let i = 0;

  while (i < len) {
    const code = ops[i++] as number;

    switch (code) {
      case OP.CREATE: {
        const id = ops[i++] as number;
        const type = ops[i++] as string;
        let el: LynxElement;
        if (type === '__comment') {
          // Vue uses comment nodes as Fragment / v-if anchors.
          // Create a zero-size text node as an invisible placeholder.
          el = __CreateRawText('');
        } else if (type === 'list') {
          // Native <list> must be created via __CreateList (not __CreateElement)
          // to enable waterfall/flow layout and item recycling.
          listElementIds.add(id);
          listItems.set(id, []);
          listItemsReported.set(id, 0);
          const cbs = createListCallbacks(id);
          el = __CreateList(
            0,
            cbs.componentAtIndex,
            cbs.enqueueComponent,
            {},
            cbs.componentAtIndexes,
          );
          __SetCSSId([el], 0);
        } else {
          el = __CreateElement(type, 0);
          // Associate element with CSS scope 0 (common/global CSS)
          // so the CSS selector engine can match class-based rules.
          __SetCSSId([el], 0);
        }
        elements.set(id, el);
        break;
      }

      case OP.CREATE_TEXT: {
        const id = ops[i++] as number;
        const el = __CreateText(0);
        __SetCSSId([el], 0);
        elements.set(id, el);
        break;
      }

      case OP.INSERT: {
        const parentId = ops[i++] as number;
        const childId = ops[i++] as number;
        const anchorId = ops[i++] as number;
        const parent = elements.get(parentId);
        const child = elements.get(childId);
        if (parent && child) {
          if (listElementIds.has(parentId)) {
            // For <list> parents, collect items instead of appending directly.
            // The native list will request items via componentAtIndex callback.
            const items = listItems.get(parentId);
            if (items) items.push({ el: child, bgId: childId });
          } else if (anchorId === -1) {
            __AppendElement(parent, child);
          } else {
            const anchor = elements.get(anchorId);
            __InsertElementBefore(parent, child, anchor);
          }
        }
        break;
      }

      case OP.REMOVE: {
        const parentId = ops[i++] as number;
        const childId = ops[i++] as number;
        const parent = elements.get(parentId);
        const child = elements.get(childId);
        if (parent && child) {
          __RemoveElement(parent, child);
        }
        break;
      }

      case OP.SET_PROP: {
        const id = ops[i++] as number;
        const key = ops[i++] as string;
        const value = ops[i++];
        if (PLATFORM_INFO_ATTRS.has(key)) {
          // Platform info attributes go into update-list-info only, not __SetAttribute.
          // Setting them both ways causes native list to count items twice.
          const info = listItemPlatformInfo.get(id);
          if (info) {
            info[key] = value;
          } else {
            listItemPlatformInfo.set(id, { [key]: value });
          }
          if (key === 'item-key') itemKeyMap.set(id, String(value));
        } else {
          const el = elements.get(id);
          if (el) __SetAttribute(el, key, value);
        }
        break;
      }

      case OP.SET_TEXT: {
        const id = ops[i++] as number;
        const text = ops[i++] as string;
        const el = elements.get(id);
        if (el) __SetAttribute(el, 'text', text);
        break;
      }

      case OP.SET_EVENT: {
        const id = ops[i++] as number;
        const eventType = ops[i++] as string;
        const eventName = ops[i++] as string;
        const sign = ops[i++];
        const el = elements.get(id);
        console.info(
          '[vue-mt] SET_EVENT id=',
          id,
          'type=',
          eventType,
          'name=',
          eventName,
          'sign=',
          sign,
          'el found=',
          el != null,
        );
        if (el) __AddEvent(el, eventType, eventName, sign);
        break;
      }

      case OP.REMOVE_EVENT: {
        // PAPI does not expose a remove-event API; skip both params
        i += 3; // id, eventType, eventName
        break;
      }

      case OP.SET_STYLE: {
        const id = ops[i++] as number;
        const value = ops[i++] as string | object;
        const el = elements.get(id);
        if (el) __SetInlineStyles(el, value);
        break;
      }

      case OP.SET_CLASS: {
        const id = ops[i++] as number;
        const cls = ops[i++] as string;
        const el = elements.get(id);
        if (el) __SetClasses(el, cls);
        break;
      }

      case OP.SET_ID: {
        const id = ops[i++] as number;
        const idStr = ops[i++] as string | null | undefined;
        const el = elements.get(id);
        if (el) __SetID(el, idStr);
        break;
      }

      case OP.SET_WORKLET_EVENT: {
        const id = ops[i++] as number;
        const eventType = ops[i++] as string;
        const eventName = ops[i++] as string;
        const ctx = ops[i++] as Record<string, unknown>;
        const el = elements.get(id);
        console.info(
          '[vue-mt] SET_WORKLET_EVENT id=',
          id,
          'type=',
          eventType,
          'name=',
          eventName,
          'ctx=',
          ctx,
          'el found=',
          el != null,
        );
        if (el) {
          // Native Lynx requires _workletType on the value to route the event
          // to runWorklet() instead of publishEvent(). React sets this in
          // workletEvent.ts:53 — we stamp it here on the MT side.
          ctx['_workletType'] = 'main-thread';
          __AddEvent(el, eventType, eventName, {
            type: 'worklet',
            value: ctx,
          });
        }
        break;
      }

      case OP.SET_MT_REF: {
        const id = ops[i++] as number;
        const refImpl = ops[i++];
        const el = elements.get(id);
        console.info(
          '[vue-mt] SET_MT_REF id=',
          id,
          'refImpl=',
          refImpl,
          'el found=',
          el != null,
        );
        // Store in workletRefMap so worklet-runtime can resolve _wvid → element.
        // The worklet-runtime's updateWorkletRef expects the ref to already exist
        // in _workletRefMap (populated during React's hydration step). For Vue,
        // we pre-register the ref before calling updateWorkletRef.
        if (
          el
          && typeof globalThis !== 'undefined'
          && 'lynxWorkletImpl' in (globalThis as Record<string, unknown>)
        ) {
          const impl = (globalThis as Record<string, unknown>)[
            'lynxWorkletImpl'
          ] as {
            _refImpl?: {
              _workletRefMap?: Record<
                number,
                { current: unknown; _wvid: number }
              >;
              updateWorkletRef(ref: unknown, el: LynxElement): void;
            };
          };
          // Pre-register the ref in the worklet-runtime's ref map so
          // updateWorkletRef can find it (Vue refs aren't hydrated like React).
          const ref = refImpl as { _wvid?: number; _initValue?: unknown };
          if (impl._refImpl && ref._wvid != null) {
            const refMap = impl._refImpl._workletRefMap;
            if (refMap && !(ref._wvid in refMap)) {
              refMap[ref._wvid] = {
                current: ref._initValue ?? null,
                _wvid: ref._wvid,
              };
            }
            impl._refImpl.updateWorkletRef(refImpl, el);
          }
        }
        break;
      }

      default:
        // Unknown op – skip (future-compat)
        break;
    }
  }

  // For any <list> elements with newly-inserted items, tell the native list
  // via the 'update-list-info' attribute. Only send items added since the last
  // applyOps call to avoid "duplicated item-key" errors.
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

  // Flush all pending PAPI changes to the native layer in one shot.
  __FlushElementTree();
}

/** Expose elements map so entry-main.ts can seed the page-root entry. */
export { elements };

/** Reset module state – for testing only. */
export function resetMainThreadState(): void {
  elements.clear();
  listItems.clear();
  listElementIds.clear();
  itemKeyMap.clear();
  listItemPlatformInfo.clear();
  listItemsReported.clear();
}
