// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Worklet } from '../../worklet-runtime/bindings/types.js';
import { LIST_EVENT_ID, setListEventDispatch } from '../../worklet-runtime/listEvent.js';
import type { ListEventDispatch } from '../../worklet-runtime/listEvent.js';
import type { PlatformInfo } from '../snapshot/platformInfo.js';
import type { SnapshotInstance } from '../snapshot/snapshot.js';
import { snapshotInstanceManager } from '../snapshot/snapshotInstanceManager.js';

interface Offset {
  x: number;
  y: number;
}
interface RestoreToken {
  element: FiberElement;
  generation: number;
  offset: Offset;
  anchor?: SnapshotInstance['__listScrollAnchor'];
}
interface ListState {
  element: FiberElement;
  owner: SnapshotInstance;
  children: readonly SnapshotInstance[];
  generation: number;
  pending?: Offset | undefined;
  inflight?: RestoreToken | undefined;
  handlers: Map<string, Worklet>;
}
const states = new Map<number, ListState>();
const pendingStates = new Set<ListState>();

/** Schedule on the owning native main-thread context, not a layout worker. */
export function requestListFrame(callback: () => void): void {
  const { requestAnimationFrame } = lynx as typeof lynx & { requestAnimationFrame?: (callback: () => void) => number };
  try {
    // The main-thread runtime's wrapper throws on SDKs before 2.16.
    if (typeof requestAnimationFrame === 'function') return void requestAnimationFrame.call(lynx, callback);
  } catch {}
  // Without a frame the bind flush has already applied the new styles, so
  // restoring now only lets the next flush carry the original transitions.
  callback();
}

/** `vertical-orientation={false}` is the deprecated spelling of a horizontal list. */
function isHorizontal(element: FiberElement): boolean {
  const orientation: unknown = __GetAttributeByName(element, 'scroll-orientation');
  if (orientation) return orientation === 'horizontal';
  return String(__GetAttributeByName(element, 'vertical-orientation')) === 'false';
}

export function isNestedListSnapshot(owner: SnapshotInstance): boolean {
  if (!owner.__snapshot_def.isListHolder) return false;
  let ancestor = owner.parentNode;
  while (ancestor && !ancestor.__snapshot_def.isListHolder) ancestor = ancestor.parentNode;
  return Boolean(ancestor);
}

/**
 * Whether a recycle must give the receiving item a new native list. The old
 * list's opaque anchor only matters when a position is not zero: the donor
 * was scrolled or still has a restore queued, or the receiver has a saved
 * position. Otherwise keeping the native list avoids recreating its cells.
 */
export function needsFreshNestedList(before: SnapshotInstance, after: SnapshotInstance): boolean {
  if (!states.size) return false;
  const element = before.__elements![before.__snapshot_def.slot[0]![1]]!;
  const state = states.get(__GetElementUniqueID(element));
  if (state?.owner !== before) return false;
  return Boolean(state.pending ?? state.inflight) || isMoved(before.__listScrollOffset)
    || isMoved(after.__listScrollOffset);
}

function isMoved(offset: Offset | undefined): boolean {
  return offset !== undefined && (offset.x !== 0 || offset.y !== 0);
}

/** Rows that are or contain a nested list need rebind suppression. */
export function isNestedListRow(owner: SnapshotInstance): boolean {
  return states.size > 0 && (Boolean(owner.__snapshot_def.isListHolder) || Boolean(owner.__listDescendantCount));
}

/** Cells of a nested list, and rows that are or contain one. */
export function isNestedListReuse(listID: number, owner: SnapshotInstance): boolean {
  return states.size > 0
    && (states.has(listID) || Boolean(owner.__snapshot_def.isListHolder) || Boolean(owner.__listDescendantCount));
}

/**
 * Slots the internal proxy always occupies. Touchstart listens in the capture
 * phase, so it also sees touches that a cell catches.
 */
const TRACKED_EVENT_TYPE: Record<string, string> = { scroll: 'bindEvent', touchstart: 'capture-bind' };

/**
 * The latest consumer main-thread handler type for an event name, or the
 * tracked type. Engines that keep one main-thread handler per element and
 * event name end with the proxy bound at this type.
 */
function slotType(state: ListState, eventName: string): string {
  let type = TRACKED_EVENT_TYPE[eventName]!;
  for (const key of state.handlers.keys()) {
    const separator = key.lastIndexOf(':');
    if (key.slice(separator + 1) === eventName) type = key.slice(0, separator);
  }
  return type;
}

/**
 * Bind the tracked proxy, then the consumer's type. Per-type native listeners
 * keep both; a single per-name slot ends with the consumer's forwarding proxy.
 */
function bindProxies(state: ListState, eventName: string): void {
  const tracked = TRACKED_EVENT_TYPE[eventName]!;
  bind(state, tracked, eventName);
  const type = slotType(state, eventName);
  if (type !== tracked) bind(state, type, eventName);
}

function bind(state: ListState, eventType: string, eventName: string): void {
  __AddEvent(state.element, eventType, eventName, {
    type: 'worklet',
    value: {
      _wkltId: LIST_EVENT_ID,
      _workletType: 'main-thread',
      listID: __GetElementUniqueID(state.element),
      eventType,
      eventName,
    },
  });
}

function containingCell(owner: SnapshotInstance): SnapshotInstance {
  let cell = owner;
  while (!cell.parentNode!.__snapshot_def.isListHolder) cell = cell.parentNode!;
  return cell;
}

/**
 * Whether a list cell is only ever recycled for its own item: its reuse
 * identifier is its item key, and so is that of every cell containing its
 * list, so no list on the path changes owner and the same key is the same item.
 */
export function isOwnReuseCell(cell: SnapshotInstance): boolean {
  for (;;) {
    const info = cell.__listItemPlatformInfo;
    if (info?.['reuse-identifier'] === undefined || info['reuse-identifier'] !== info['item-key']) return false;
    const list = cell.parentNode;
    if (!list) return false;
    if (!isNestedListSnapshot(list)) return true;
    cell = containingCell(list);
  }
}

export function createNestedListState(
  owner: SnapshotInstance,
  element: FiberElement,
  children: readonly SnapshotInstance[] = [],
): void {
  if (
    typeof __InvokeUIMethod !== 'function' || typeof __GetAttributeByName !== 'function'
    // Web lists do not recycle cells while scrolling, and Web keeps one caught
    // flag per element and phase, so internal listeners would alter catches.
    || String(SystemInfo.platform).startsWith('web')
    || !isNestedListSnapshot(owner)
    // Such a list keeps its native behavior.
    || isOwnReuseCell(containingCell(owner))
  ) return;
  const state: ListState = {
    element,
    owner,
    children,
    generation: 0,
    handlers: new Map(owner.__listWorkletEvents),
    // Restore even a saved zero: a list with `initial-scroll-index` does not start there.
    pending: owner.__listScrollOffset,
  };
  const listID = __GetElementUniqueID(element);
  destroyNestedListState(listID);
  states.set(listID, state);
  setListEventDispatch(dispatchNestedListEvent);
  if (state.pending) pendingStates.add(state);
  // Native visible-cell coordinates let restoration target the logical cell,
  // instead of anchoring to an unmeasured prefix at virtual index zero.
  __SetAttribute(element, 'needs-visible-cells', true);
  for (const eventName in TRACKED_EVENT_TYPE) bindProxies(state, eventName);
}

/** Publish the same data source as the native callbacks, before native updates can reenter. */
export function updateNestedListChildren(
  owner: SnapshotInstance,
  element: FiberElement,
  children: readonly SnapshotInstance[],
): void {
  if (!states.size) return;
  const state = states.get(__GetElementUniqueID(element));
  if (state?.owner === owner) state.children = children;
}

const dispatchNestedListEvent: ListEventDispatch = (context, params, options, run) => {
  const current = states.get(context['listID'] as number);
  if (!current) return;
  const name = context['eventName'] as string;
  const raw = params[0] as { detail?: Record<string, unknown>; [key: string]: unknown };
  const detail = raw.detail ?? raw;
  if (name === 'touchstart') {
    current.generation++;
    current.pending = undefined;
    pendingStates.delete(current);
    current.inflight = undefined;
  }
  const target = (raw['target'] as { elementRefptr?: FiberElement } | undefined)?.elementRefptr;
  // Only user scrolling of this list is this owner's position: a nested
  // list's scroll can bubble here. While a restore is pending or in flight,
  // the rebound list still reports the donor's offset.
  if (
    name === 'scroll' && !current.pending && !current.inflight
    && (!target || __GetElementUniqueID(target) === context['listID'])
    && (detail['eventSource'] === undefined || detail['eventSource'] === 2)
  ) {
    const cells = detail['attachedCells'];
    let anchor: SnapshotInstance['__listScrollAnchor'];
    if (Array.isArray(cells)) {
      const horizontal = isHorizontal(current.element);
      const children = current.children;
      for (const rawCell of cells) {
        const cell = rawCell as { index?: number; position?: number; itemKey?: string; left?: number; top?: number };
        const index = cell.index ?? cell.position;
        if (index === undefined) continue;
        const child = children[index];
        const platformInfo = child?.__listItemPlatformInfo;
        const itemKey = platformInfo?.['item-key'];
        if (!itemKey || platformInfo?.['sticky-top'] || platformInfo?.['sticky-bottom'] || itemKey !== cell.itemKey) {
          continue;
        }
        const viewportOffset = (horizontal ? cell.left : cell.top)!;
        if (!Number.isFinite(viewportOffset)) continue;
        if (
          !anchor
          || (viewportOffset <= 0 && (anchor.viewportOffset > 0 || viewportOffset > anchor.viewportOffset))
          || (viewportOffset > 0 && anchor.viewportOffset > 0 && viewportOffset < anchor.viewportOffset)
        ) anchor = { itemKey, viewportOffset };
      }
      // A delayed event carrying another data source's cells is not this
      // owner's new scroll intent.
      if (cells.length && !anchor) {
        const handler = current.handlers.get(`${context['eventType'] as string}:${name}`);
        return handler && run(handler, params, options);
      }
    }
    current.owner.__listScrollOffset = {
      x: Number(detail['scrollLeft'] ?? 0),
      y: Number(detail['scrollTop'] ?? 0),
    };
    current.owner.__listScrollAnchor = anchor;
  }
  const eventType = context['eventType'] as string;
  const handler = current.handlers.get(`${eventType}:${name}`);
  return handler && run(handler, params, options);
};

/** SSR decodes attributes before attaching native elements to the snapshot. */
export function recordNestedListEvent(
  owner: SnapshotInstance,
  elementIndex: number,
  eventType: string,
  eventName: string,
  handler: Worklet | null | undefined,
): void {
  if (eventName !== 'scroll' && eventName !== 'touchstart') return;
  // JSX spreads pass a values-only facade to updateWorkletEvent.
  if (!owner.__snapshot_def) {
    const original = snapshotInstanceManager.values.get(owner.__id);
    if (!original) return;
    owner = original;
  }
  if (!isNestedListSnapshot(owner) || owner.__snapshot_def.slot[0]?.[1] !== elementIndex) return;
  const key = `${eventType}:${eventName}`;
  if (handler) (owner.__listWorkletEvents ??= new Map()).set(key, handler);
  else owner.__listWorkletEvents?.delete(key);
}

/** Clearing a native background listener can also clear its independent worklet slot. */
export function retainNestedListEvent(element: FiberElement, eventType: string, eventName: string): void {
  if (!states.size || (eventName !== 'scroll' && eventName !== 'touchstart')) return;
  const state = states.get(__GetElementUniqueID(element));
  if (!state) return;
  // Per-type listeners lose this type's consumer proxy too.
  if (state.handlers.has(`${eventType}:${eventName}`)) bind(state, eventType, eventName);
  bindProxies(state, eventName);
}

/** Preserve the original worklet context and its normal hydration/delay path. */
export function bindNestedListEvent(
  element: FiberElement,
  eventType: string,
  eventName: string,
  handler: Worklet | null | undefined,
): boolean {
  if (eventName !== 'scroll' && eventName !== 'touchstart') return false;
  const state = states.get(__GetElementUniqueID(element));
  if (!state) return false;
  const key = `${eventType}:${eventName}`;
  state.handlers.delete(key);
  if (handler) {
    state.handlers.set(key, handler);
  } else if (eventType !== TRACKED_EVENT_TYPE[eventName]) {
    // Clear this type with the SDK's usual empty descriptor first.
    __AddEvent(element, eventType, eventName, { type: 'worklet', value: { _workletType: 'main-thread' } });
  }
  bindProxies(state, eventName);
  return true;
}

export function transferNestedListState(owner: SnapshotInstance, element: FiberElement, preserve: boolean): void {
  const state = states.get(__GetElementUniqueID(element));
  if (!state || state.owner === owner) return;
  if (!preserve) captureNestedListMeasurements(state.owner);
  if (preserve) {
    owner.__listScrollOffset = state.owner.__listScrollOffset;
    owner.__listScrollAnchor = state.owner.__listScrollAnchor;
  }
  state.owner = owner;
  // Preserved content keeps any queued or in-flight restore; a new owner does not.
  if (!preserve) {
    state.generation++;
    state.inflight = undefined;
    state.pending = owner.__listScrollOffset ?? { x: 0, y: 0 };
    pendingStates.add(state);
  }
}

/** Retain the old logical cells' measured extents before their native list changes owner. */
export function captureNestedListMeasurements(owner: SnapshotInstance): void {
  if (!owner.__listScrollOffset?.x && !owner.__listScrollOffset?.y) return;
  if (!isNestedListSnapshot(owner) || !owner.__elements || typeof __GetComputedStyleByKey !== 'function') return;
  const element = owner.__elements[owner.__snapshot_def.slot[0]![1]]!;
  const state = states.get(__GetElementUniqueID(element));
  if (state?.owner !== owner) return;
  const horizontal = isHorizontal(element);
  const orientation = horizontal ? 'horizontal' : 'vertical';
  const axis = horizontal ? 'width' : 'height';
  const leading = horizontal ? 'margin-left' : 'margin-top';
  const trailing = horizontal ? 'margin-right' : 'margin-bottom';
  for (const child of owner.childNodes) {
    const root = child.__element_root;
    if (!root) continue;
    const size = Number.parseFloat(__GetComputedStyleByKey(root, axis));
    const first = Number.parseFloat(__GetComputedStyleByKey(root, leading));
    const last = Number.parseFloat(__GetComputedStyleByKey(root, trailing));
    const extent = size + first + last;
    if (!Number.isFinite(extent) || extent <= 0) continue;
    child.__listItemMeasuredExtent = extent;
    child.__listItemMeasuredOrientation = orientation;
  }
}

/** Seed only the existing native estimate; explicit consumer metadata always wins. */
export function getRetainedListItemPlatformInfo(
  list: SnapshotInstance,
  child: SnapshotInstance,
  info: PlatformInfo | undefined = child.__listItemPlatformInfo,
): PlatformInfo | undefined {
  if (!list.__listScrollOffset?.x && !list.__listScrollOffset?.y) return info;
  if (
    !child.__listItemMeasuredExtent || !isNestedListSnapshot(list) || !list.__elements
    || info?.['estimated-main-axis-size-px'] !== undefined
  ) return info;
  const element = list.__elements[list.__snapshot_def.slot[0]![1]]!;
  const orientation = isHorizontal(element) ? 'horizontal' : 'vertical';
  if (child.__listItemMeasuredOrientation !== orientation) return info;
  return { ...info, 'estimated-main-axis-size-px': child.__listItemMeasuredExtent };
}

export function isCurrentNestedListOwner(owner: SnapshotInstance, element: FiberElement): boolean {
  const state = states.get(__GetElementUniqueID(element));
  return !state || state.owner === owner;
}

/** Capture a binding's identity now; apply its offset once after its commit. */
export function prepareNestedListRestore(root: SnapshotInstance): (() => void) | undefined {
  if (!pendingStates.size || (!root.__snapshot_def?.isListHolder && !root.__listDescendantCount)) return;
  const tokens: { state: ListState; token: RestoreToken }[] = [];
  const visit = (owner: SnapshotInstance): void => {
    if (owner.__snapshot_def?.isListHolder && owner.__elements) {
      const element = owner.__elements[owner.__snapshot_def.slot[0]![1]]!;
      const state = states.get(__GetElementUniqueID(element));
      if (state?.pending && state.owner === owner) {
        tokens.push({
          state,
          token: {
            element,
            generation: state.generation,
            offset: state.pending,
            anchor: owner.__listScrollAnchor && { ...owner.__listScrollAnchor },
          },
        });
      }
    }
    // Leaf-only lists need no child-array materialization, regardless of length.
    if (!owner.__listDescendantCount) return;
    for (const child of owner.childNodes) {
      if (Boolean(child.__snapshot_def?.isListHolder) || Boolean(child.__listDescendantCount)) visit(child);
    }
  };
  visit(root);
  if (!tokens.length) return;
  return () => {
    for (const { state, token } of tokens) {
      const { element, generation, offset } = token;
      const { owner } = state;
      if (
        state.generation !== generation || state.pending !== offset
        || owner.__elements?.[owner.__snapshot_def.slot[0]![1]] !== element
      ) continue;
      // Consume before invoking native: reentrant callbacks cannot issue twice.
      state.pending = undefined;
      pendingStates.delete(state);
      state.inflight = token;
      const anchorIndex = token.anchor
        ? state.children.findIndex(child => child.__listItemPlatformInfo?.['item-key'] === token.anchor!.itemKey)
        : -1;
      const position = anchorIndex >= 0 ? anchorIndex : 0;
      const viewportOffset = anchorIndex >= 0 ? token.anchor!.viewportOffset : -(offset.x || offset.y);
      __InvokeUIMethod(element, 'scrollToPosition', {
        position,
        alignTo: 'top',
        offset: viewportOffset,
        smooth: false,
      }, () => {
        if (state.inflight === token && state.generation === generation) state.inflight = undefined;
      });
    }
  };
}

export function destroyNestedListState(listID: number): void {
  const state = states.get(listID);
  if (state) {
    state.generation++;
    state.pending = undefined;
    pendingStates.delete(state);
    state.inflight = undefined;
    state.handlers.clear();
    states.delete(listID);
  }
}
export function clearNestedListState(): void {
  for (const id of states.keys()) destroyNestedListState(id);
}
