// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { globalEnvManager } from './utils/envManager';
import { elementTree } from './utils/nativeMethod';
import { gSignMap } from '../../src/snapshot/list/list';
import { __pendingListUpdates } from '../../src/snapshot/list/pendingListUpdates';
import {
  captureNestedListMeasurements,
  clearNestedListState,
  createNestedListState,
  destroyNestedListState,
  getRetainedListItemPlatformInfo,
  isNestedListSnapshot,
  isOwnReuseCell,
  prepareNestedListRestore,
  transferNestedListState,
  updateNestedListChildren,
} from '../../src/snapshot/list/nativeState';
import { snapshotManager } from '../../src/snapshot/snapshot/definition';
import { DynamicPartType } from '../../src/snapshot/snapshot/dynamicPartType';
import { updateEvent } from '../../src/snapshot/snapshot/event';
import { SnapshotInstance, snapshotInstanceManager } from '../../src/snapshot/snapshot/snapshot';
import { updateSpread } from '../../src/snapshot/snapshot/spread';
import { updateWorkletEvent } from '../../src/snapshot/snapshot/workletEvent';
import { RunWorkletSource } from '../../src/worklet-runtime/bindings/types';
import type { Worklet } from '../../src/worklet-runtime/bindings/types';
import { EventResult } from '../../src/worklet-runtime/eventPropagation';
import { nestedListBridge, LIST_EVENT_ID, setListEventDispatch } from '../../src/worklet-runtime/listEvent';
import { initWorklet } from '../../src/worklet-runtime/workletRuntime';

interface EventSlots {
  background?: string;
  worklet?: Worklet;
}

const eventSlots = new Map<FiberElement, Map<string, EventSlots>>();
const invoke = vi.fn();
const run = vi.fn();

function slots(element: FiberElement, name = 'scroll', type = 'bindEvent'): EventSlots {
  return eventSlots.get(element)?.get(`${type}:${name}`) ?? {};
}

function emit(element: FiberElement, detail: Record<string, unknown>, name = 'scroll', type = 'bindEvent'): unknown {
  const context = slots(element, name, type).worklet;
  expect(context?._wkltId).toBe(LIST_EVENT_ID);
  return nestedListBridge().dispatch!(context!, [{ detail }], undefined, run);
}

function makeOwner(element: FiberElement = __CreateElement('list', 0)): SnapshotInstance {
  const outer = new SnapshotInstance('nested-state-list');
  const row = new SnapshotInstance('nested-state-row');
  const owner = new SnapshotInstance('nested-state-list');
  // Use registered logical snapshots and the normal ancestor-count updates.
  outer.insertBefore(row);
  row.insertBefore(owner);
  owner.__elements = [element];
  owner.__element_root = element;
  __SetAttribute(element, 'scroll-orientation', 'horizontal');
  return owner;
}

function elementOf(owner: SnapshotInstance): FiberElement {
  return owner.__element_root!;
}

function track(owner: SnapshotInstance): void {
  createNestedListState(owner, elementOf(owner), owner.childNodes);
}

function setBackground(
  owner: SnapshotInstance,
  handler: (() => void) | undefined,
  type = 'bindEvent',
  name = 'scroll',
): void {
  owner.__values ??= [];
  const old = owner.__values[0];
  owner.__values[0] = handler;
  updateEvent(owner, 0, old, 0, type, name, '');
}

function setMainThread(
  owner: SnapshotInstance,
  handler: Worklet | undefined,
  type = 'bindEvent',
  name = 'scroll',
): void {
  owner.__values ??= [];
  const old = owner.__values[1] as Worklet;
  owner.__values[1] = handler;
  updateWorkletEvent(owner, 1, old, 0, 'main-thread', type, name);
}

beforeEach(() => {
  globalEnvManager.resetEnv();
  elementTree.clear();
  snapshotManager.values.set('nested-state-list', {
    create: () => [__CreateElement('list', 0)],
    update: [],
    slot: [[DynamicPartType.ListChildren, 0]],
    isListHolder: true,
  });
  snapshotManager.values.set('nested-state-row', {
    create: () => [__CreateView(0)],
    update: [],
    slot: [[DynamicPartType.Children, 0]],
  });
  eventSlots.clear();
  invoke.mockReset();
  run.mockReset();
  vi.stubGlobal('__InvokeUIMethod', invoke);
  vi.stubGlobal('__GetComputedStyleByKey', (_element: FiberElement, key: string) => key === 'width' ? '120' : '0');
  // Native and Web keep background/worklet additions in independent slots.
  // Clearing an event clears both slots; the SDK must reinstall its proxy.
  vi.stubGlobal('__AddEvent', (
    element: FiberElement,
    type: string,
    name: string,
    handler: string | { type: string; value: Worklet } | undefined,
  ) => {
    let events = eventSlots.get(element);
    if (!events) eventSlots.set(element, events = new Map());
    const key = `${type}:${name}`;
    if (handler === undefined) {
      events.delete(key);
    } else {
      const entry = events.get(key) ?? {};
      if (typeof handler === 'string') entry.background = handler;
      else entry.worklet = handler.value;
      events.set(key, entry);
    }
  });
});

afterEach(() => {
  clearNestedListState();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  globalEnvManager.resetEnv();
  elementTree.clear();
});

describe('nested list state ownership', () => {
  it('does not add tracking or restoration to an ordinary top-level list', () => {
    const owner = new SnapshotInstance('nested-state-list');
    const element = __CreateElement('list', 0);
    owner.__elements = [element];
    owner.__element_root = element;

    track(owner);

    expect(eventSlots.has(element)).toBe(false);
    expect(prepareNestedListRestore(owner)).toBeUndefined();
    expect(invoke).not.toHaveBeenCalled();
    expect(isNestedListSnapshot(new SnapshotInstance('nested-state-row'))).toBe(false);
  });

  it.each(['web', 'web-ssr'])('does not track nested lists on the %s platform', platform => {
    vi.stubGlobal('SystemInfo', { ...SystemInfo, platform });
    const owner = makeOwner();
    const element = elementOf(owner);

    track(owner);

    expect(eventSlots.has(element)).toBe(false);
    expect(elementTree.__GetAttributes(element)['needs-visible-cells']).toBeUndefined();
  });

  it('does not restore an unrelated list while another logical item has pending work', () => {
    const pending = makeOwner();
    pending.__listScrollOffset = { x: 40, y: 0 };
    track(pending);
    const other = makeOwner();
    track(other);

    expect(prepareNestedListRestore(other)).toBeUndefined();
    expect(invoke).not.toHaveBeenCalled();
  });

  it.each(['__InvokeUIMethod', '__GetAttributeByName'])('does not enable tracking without %s', capability => {
    const owner = makeOwner();
    const element = elementOf(owner);
    vi.stubGlobal(capability, undefined);

    track(owner);
    const next = makeOwner(element);
    transferNestedListState(next, element, false);

    expect(eventSlots.has(element)).toBe(false);
    expect(elementTree.__GetAttributes(element)['needs-visible-cells']).toBeUndefined();
    expect(prepareNestedListRestore(next)).toBeUndefined();
    expect(invoke).not.toHaveBeenCalled();
  });

  it('records scroll and actively resets a nonzero donor exactly once for a new logical item', () => {
    const before = makeOwner();
    const element = elementOf(before);
    track(before);
    emit(element, { scrollLeft: 140, eventSource: 2 });
    expect(before.__listScrollOffset).toEqual({ x: 140, y: 0 });

    const after = makeOwner(element);
    transferNestedListState(after, element, false);
    prepareNestedListRestore(after)!();
    expect(invoke).toHaveBeenCalledExactlyOnceWith(
      element,
      'scrollToPosition',
      expect.objectContaining({
        position: 0,
        alignTo: 'top',
        smooth: false,
      }),
      expect.any(Function),
    );
    expect(Math.abs(invoke.mock.calls[0]![2].offset)).toBe(0);

    invoke.mock.calls[0]![3]();
    emit(element, { scrollLeft: 20, eventSource: 2 });
    expect(after.__listScrollOffset).toEqual({ x: 20, y: 0 });
    expect(before.__listScrollOffset).toEqual({ x: 140, y: 0 });
    transferNestedListState(after, element, false);
    expect(prepareNestedListRestore(after)).toBeUndefined();
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it('restores the receiving logical item rather than the donor offset', () => {
    const before = makeOwner();
    const element = elementOf(before);
    track(before);
    emit(element, { scrollLeft: 200 });
    const after = makeOwner(element);
    after.__listScrollOffset = { x: 75, y: 0 };

    transferNestedListState(after, element, false);
    prepareNestedListRestore(after)!();
    expect(invoke.mock.calls[0]![2]).toMatchObject({ offset: -75, smooth: false });
  });

  it('rejects an old A→B restore after the element is rebound to A', () => {
    const a = makeOwner();
    const element = elementOf(a);
    const b = makeOwner(element);
    track(a);
    transferNestedListState(b, element, false);
    const stale = prepareNestedListRestore(b)!;
    transferNestedListState(a, element, false);

    stale();
    expect(invoke).not.toHaveBeenCalled();
    prepareNestedListRestore(a)!();
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it('does not let an old native ACK expire the current owner restore', () => {
    const a = makeOwner();
    const element = elementOf(a);
    const b = makeOwner(element);
    a.__listScrollOffset = { x: 80, y: 0 };
    b.__listScrollOffset = { x: 40, y: 0 };
    track(a);
    transferNestedListState(b, element, false);
    prepareNestedListRestore(b)!();
    transferNestedListState(a, element, false);
    prepareNestedListRestore(a)!();

    invoke.mock.calls[0]![3]();
    // The rebound list's DIFF baseline and in-flight scrolls are not recorded.
    emit(element, { scrollLeft: 0, eventSource: 0 });
    emit(element, { scrollLeft: 999, eventSource: 2 });
    expect(a.__listScrollOffset).toEqual({ x: 80, y: 0 });
    invoke.mock.calls[1]![3]();
    emit(element, { scrollLeft: 90, eventSource: 2 });
    expect(a.__listScrollOffset).toEqual({ x: 90, y: 0 });
  });

  it('does not treat a detached own-key cell as reused only for its own item', () => {
    const cell = new SnapshotInstance('nested-state-row');
    cell.__listItemPlatformInfo = { 'item-key': 'a', 'reuse-identifier': 'a' };
    expect(isOwnReuseCell(cell)).toBe(false);
  });

  it('requires the reuse identifier to equal the item key in every containing cell', () => {
    const cell = (info: Record<string, string>, children: SnapshotInstance[] = []) => {
      const row = new SnapshotInstance('nested-state-row');
      row.__listItemPlatformInfo = info;
      for (const child of children) row.insertBefore(child);
      return row;
    };
    const tree = (top: Record<string, string>, inner: Record<string, string>) => {
      const innerCell = cell(inner);
      const middle = new SnapshotInstance('nested-state-list');
      middle.insertBefore(innerCell);
      const outer = new SnapshotInstance('nested-state-list');
      outer.insertBefore(cell(top, [middle]));
      return innerCell;
    };
    const own = (key: string) => ({ 'item-key': key, 'reuse-identifier': key });

    expect(isOwnReuseCell(tree(own('a'), own('c0')))).toBe(true);
    expect(isOwnReuseCell(tree({ 'item-key': 'a' }, own('c0')))).toBe(false);
    expect(isOwnReuseCell(tree(own('a'), { 'item-key': 'c0' }))).toBe(false);
    expect(isOwnReuseCell(tree(own('a'), { 'reuse-identifier': 'c0' }))).toBe(false);
  });

  it('records only scroll events whose target is the tracked list', () => {
    const owner = makeOwner();
    const element = elementOf(owner);
    track(owner);
    const handler: Worklet = { _wkltId: 'consumer-scroll' };
    setMainThread(owner, handler);
    const inner = __CreateElement('list', 0);
    const bubbled = { target: { elementRefptr: inner }, detail: { scrollLeft: 90, eventSource: 2 } };

    // A nested list's scroll bubbles to its ancestors' listeners.
    nestedListBridge().dispatch!(slots(element).worklet!, [bubbled], undefined, run);
    expect(owner.__listScrollOffset).toBeUndefined();
    expect(run).toHaveBeenCalledExactlyOnceWith(handler, [bubbled], undefined);

    const own = { target: { elementRefptr: element }, detail: { scrollLeft: 30, eventSource: 2 } };
    nestedListBridge().dispatch!(slots(element).worklet!, [own], undefined, run);
    expect(owner.__listScrollOffset).toEqual({ x: 30, y: 0 });
  });

  it('forwards scroll events to consumers during a pending restore without recording them', () => {
    const a = makeOwner();
    const element = elementOf(a);
    a.__listScrollOffset = { x: 80, y: 0 };
    track(a);
    const handler: Worklet = { _wkltId: 'consumer-scroll' };
    setMainThread(a, handler);
    const b = makeOwner(element);
    b.__listScrollOffset = { x: 20, y: 0 };
    transferNestedListState(b, element, false);

    // A rebound list reports the donor's offset in its DIFF baseline.
    run.mockReturnValue('consumer-result');
    expect(emit(element, { scrollLeft: 80, eventSource: 0 })).toBe('consumer-result');
    expect(run).toHaveBeenCalledExactlyOnceWith(handler, [{ detail: { scrollLeft: 80, eventSource: 0 } }], undefined);
    expect(b.__listScrollOffset).toEqual({ x: 20, y: 0 });
  });

  it('cancels a prepared restore when the user touches the rebound list', () => {
    const before = makeOwner();
    const element = elementOf(before);
    const after = makeOwner(element);
    track(before);
    transferNestedListState(after, element, false);
    const restore = prepareNestedListRestore(after)!;

    emit(element, {}, 'touchstart', 'capture-bind');
    restore();
    expect(invoke).not.toHaveBeenCalled();
    emit(element, { scrollLeft: 36, eventSource: 2 });
    expect(after.__listScrollOffset).toEqual({ x: 36, y: 0 });
  });

  it('discards pending work and ignores old events when the list is destroyed', () => {
    const owner = makeOwner();
    const element = elementOf(owner);
    owner.__listScrollOffset = { x: 60, y: 0 };
    track(owner);
    const restore = prepareNestedListRestore(owner)!;

    destroyNestedListState(__GetElementUniqueID(element));
    restore();
    emit(element, { scrollLeft: 100, eventSource: 2 });
    expect(owner.__listScrollOffset).toEqual({ x: 60, y: 0 });
    expect(invoke).not.toHaveBeenCalled();
  });
});

describe('nested list consumer event handlers', () => {
  it('can materialize an old physical cache cell after its logical snapshots were removed', () => {
    __pendingListUpdates.values = {};
    const outer = new SnapshotInstance('list');
    const row = new SnapshotInstance('view');
    const inner = new SnapshotInstance('list');
    const child = new SnapshotInstance('view');
    const handler: Worklet = { _wkltId: 'retained-cell-touch' };
    const originalIDs = [row.__id, inner.__id, child.__id];
    child.setAttribute('values', [{ 'main-thread:bindtouchstart': handler }]);
    inner.insertBefore(child);
    row.insertBefore(inner);
    outer.insertBefore(row);
    outer.ensureElements();

    const outerElement = elementOf(outer);
    const firstSign = elementTree.triggerComponentAtIndex(outerElement, 0);
    const retainedList = elementOf(inner);
    const retainedListID = __GetElementUniqueID(retainedList);
    expect(child.__elements).toBeUndefined();
    // Moving asks for the same row before enqueue; the old native subtree
    // remains in the physical cache under retained snapshot clones.
    const secondSign = elementTree.triggerComponentAtIndex(outerElement, 0);
    expect(secondSign).not.toBe(firstSign);
    expect(gSignMap[__GetElementUniqueID(outerElement)]!.has(firstSign)).toBe(true);
    outer.removeChild(row);
    for (const id of originalIDs) expect(snapshotInstanceManager.values.has(id)).toBe(false);

    // The retained list's callback can still lazily materialize its cell.
    // Its spread event facade must not assume the original ID is registered.
    const sign = elementTree.triggerComponentAtIndex(retainedList, 0);
    const retainedChild = gSignMap[retainedListID]!.get(sign)!;

    expect(retainedChild.__id).toBe(originalIDs[2]);
    expect(__GetElementUniqueID(elementOf(retainedChild))).toBe(sign);
    expect(slots(elementOf(retainedChild), 'touchstart').worklet).toBe(handler);
    expect(gSignMap[retainedListID]!.size).toBe(1);
  });

  it('keeps the normal main-thread handler path on an untracked native element', () => {
    const owner = makeOwner();
    const element = elementOf(owner);
    const handler: Worklet = { _wkltId: 'untracked-scroll' };

    setMainThread(owner, handler);

    expect(slots(element).worklet).toBe(handler);
    expect(invoke).not.toHaveBeenCalled();
  });

  it('does not treat a wrapper event as an event on its coalesced nested list', () => {
    snapshotManager.values.set('nested-state-wrapped', {
      create: () => [__CreateView(0), __CreateElement('list', 0)],
      update: [],
      slot: [[DynamicPartType.ListChildren, 1]],
      isListHolder: true,
    });
    const outer = new SnapshotInstance('nested-state-list');
    const owner = new SnapshotInstance('nested-state-wrapped');
    outer.insertBefore(owner);
    owner.ensureElements();
    const list = owner.__elements![1]!;
    createNestedListState(owner, list);
    const handler: Worklet = { _wkltId: 'wrapper-scroll' };

    setMainThread(owner, handler);

    expect(owner.__listWorkletEvents).toBeUndefined();
    expect(slots(elementOf(owner)).worklet).toBe(handler);
    expect(slots(list).worklet?._wkltId).toBe(LIST_EVENT_ID);
  });

  it('leaves an untracked element alone when its background scroll listener is cleared', () => {
    track(makeOwner());
    const flat = new SnapshotInstance('nested-state-list');
    const element = __CreateElement('list', 0);
    flat.__elements = [element];
    flat.__element_root = element;
    setBackground(flat, () => {});

    setBackground(flat, undefined);

    expect(eventSlots.get(element)?.has('bindEvent:scroll')).toBe(false);
  });

  it('rebinds an earlier consumer type when a background listener of that type is cleared', () => {
    const owner = makeOwner();
    const element = elementOf(owner);
    track(owner);
    const catchHandler: Worklet = { _wkltId: 'consumer-catch-scroll' };
    owner.__values = [undefined, catchHandler, { _wkltId: 'consumer-capture-scroll' }];
    updateWorkletEvent(owner, 1, undefined as unknown as Worklet, 0, 'main-thread', 'catchEvent', 'scroll');
    updateWorkletEvent(owner, 2, undefined as unknown as Worklet, 0, 'main-thread', 'capture-bind', 'scroll');
    setBackground(owner, () => {}, 'catchEvent', 'scroll');

    setBackground(owner, undefined, 'catchEvent', 'scroll');

    expect(slots(element, 'scroll', 'catchEvent').worklet?._wkltId).toBe(LIST_EVENT_ID);
    emit(element, { scrollLeft: 9, eventSource: 2 }, 'scroll', 'catchEvent');
    expect(run).toHaveBeenCalledExactlyOnceWith(
      catchHandler,
      [{ detail: { scrollLeft: 9, eventSource: 2 } }],
      undefined,
    );
  });

  it('keeps the capture touch proxy when a consumer touch handler exists before tracking', () => {
    const owner = makeOwner();
    const element = elementOf(owner);
    const handler: Worklet = { _wkltId: 'consumer-touch' };
    setMainThread(owner, handler, 'bindEvent', 'touchstart');

    track(owner);

    expect(slots(element, 'touchstart', 'capture-bind').worklet?._wkltId).toBe(LIST_EVENT_ID);
    emit(element, {}, 'touchstart', 'bindEvent');
    expect(run).toHaveBeenCalledExactlyOnceWith(handler, [{ detail: {} }], undefined);
  });

  it('keeps the internal touch proxy out of the bubble-phase slots a background catch uses', () => {
    const owner = makeOwner();
    const element = elementOf(owner);
    track(owner);
    setBackground(owner, () => {}, 'catchEvent', 'touchstart');

    // Web lets a bubble-phase worklet on the same element cancel a background catch.
    expect(slots(element, 'touchstart', 'catchEvent')).toEqual({ background: `${owner.__id}:0:` });
    expect(slots(element, 'touchstart', 'bindEvent').worklet).toBeUndefined();
    expect(slots(element, 'touchstart', 'capture-bind').worklet?._wkltId).toBe(LIST_EVENT_ID);
  });

  it('does not leave a catch touch proxy after removing a background-only listener', () => {
    const owner = makeOwner();
    const element = elementOf(owner);
    track(owner);
    setBackground(owner, () => {}, 'catchEvent', 'touchstart');
    expect(slots(element, 'touchstart', 'catchEvent').background).toBe(`${owner.__id}:0:`);

    setBackground(owner, undefined, 'catchEvent', 'touchstart');

    expect(eventSlots.get(element)?.has('catchEvent:touchstart')).toBe(false);
    expect(slots(element, 'touchstart', 'capture-bind').worklet?._wkltId).toBe(LIST_EVENT_ID);
    emit(element, {}, 'touchstart', 'capture-bind');
    expect(run).not.toHaveBeenCalled();
  });

  it('preserves a real main-thread catch consumer when clearing its background listener', () => {
    const owner = makeOwner();
    const element = elementOf(owner);
    const handler: Worklet = { _wkltId: 'consumer-catch-touch' };
    track(owner);
    setMainThread(owner, handler, 'catchEvent', 'touchstart');
    setBackground(owner, () => {}, 'catchEvent', 'touchstart');

    setBackground(owner, undefined, 'catchEvent', 'touchstart');
    emit(element, {}, 'touchstart', 'catchEvent');

    expect(slots(element, 'touchstart', 'catchEvent').background).toBeUndefined();
    expect(run).toHaveBeenCalledExactlyOnceWith(handler, [{ detail: {} }], undefined);
    expect(slots(element, 'touchstart', 'capture-bind').worklet?._wkltId).toBe(LIST_EVENT_ID);
  });

  it('uses the baseline empty descriptor for a removed main-thread catch consumer', () => {
    const owner = makeOwner();
    const element = elementOf(owner);
    track(owner);
    setBackground(owner, () => {}, 'catchEvent', 'touchstart');
    setMainThread(owner, { _wkltId: 'consumer-catch-touch' }, 'catchEvent', 'touchstart');

    setMainThread(owner, undefined, 'catchEvent', 'touchstart');

    expect(owner.__listWorkletEvents?.has('catchEvent:touchstart')).toBe(false);
    expect(slots(element, 'touchstart', 'catchEvent')).toEqual({
      background: `${owner.__id}:0:`,
      worklet: { _workletType: 'main-thread' },
    });
    setBackground(owner, undefined, 'catchEvent', 'touchstart');
    expect(eventSlots.get(element)?.has('catchEvent:touchstart')).toBe(false);
    expect(slots(element, 'touchstart', 'capture-bind').worklet?._wkltId).toBe(LIST_EVENT_ID);
  });

  it.each(['background', 'main-thread'])('preserves both event slots when clearing the %s handler', clear => {
    const owner = makeOwner();
    const element = elementOf(owner);
    const handler: Worklet = { _wkltId: 'consumer-scroll' };
    track(owner);
    setMainThread(owner, handler);
    setBackground(owner, () => {});
    expect(slots(element).background).toBe(`${owner.__id}:0:`);
    emit(element, { scrollLeft: 15 });
    expect(run).toHaveBeenCalledExactlyOnceWith(handler, [{ detail: { scrollLeft: 15 } }], undefined);
    run.mockClear();

    if (clear === 'background') setBackground(owner, undefined);
    else setMainThread(owner, undefined);
    emit(element, { scrollLeft: 30 });

    expect(owner.__listScrollOffset).toEqual({ x: 30, y: 0 });
    if (clear === 'background') {
      expect(slots(element).background).toBeUndefined();
      expect(run).toHaveBeenCalledTimes(1);
    } else {
      expect(slots(element).background).toBe(`${owner.__id}:0:`);
      expect(owner.__listWorkletEvents?.has('bindEvent:scroll')).toBe(false);
      expect(run).not.toHaveBeenCalled();
    }
  });

  it('keeps internal tracking when both spread event handlers are removed', () => {
    const owner = makeOwner();
    const element = elementOf(owner);
    track(owner);
    const previous = { bindscroll: () => {}, 'main-thread:bindscroll': { _wkltId: 'spread-scroll' } };
    owner.__values = [previous];
    updateSpread(owner, 0, {}, 0);
    emit(element, { scrollLeft: 12 });
    expect(run).toHaveBeenCalledTimes(1);
    run.mockClear();

    owner.__values = [{}];
    updateSpread(owner, 0, previous, 0);
    emit(element, { scrollLeft: 24 });

    expect(slots(element).background).toBeUndefined();
    expect(owner.__listScrollOffset).toEqual({ x: 24, y: 0 });
    expect(run).not.toHaveBeenCalled();
  });
});

describe('nested list anchors and measured estimates', () => {
  it('accepts legacy vertical payloads and chooses the closest usable cell around the viewport start', () => {
    const owner = makeOwner();
    const element = elementOf(owner);
    __SetAttribute(element, 'scroll-orientation', 'vertical');
    for (const key of ['a', 'b', 'c', 'd', 'e', 'f', 'invalid', 'sticky-top', 'sticky-bottom']) {
      const child = new SnapshotInstance('nested-state-row');
      child.__listItemPlatformInfo = { 'item-key': key, ...(key.startsWith('sticky') ? { [key]: true } : {}) };
      owner.insertBefore(child);
    }
    track(owner);
    const detail = {
      scrollTop: 100,
      attachedCells: [
        { position: 0, itemKey: 'a', top: 60 },
        { index: 1, itemKey: 'b', top: 20 },
        { index: 2, itemKey: 'c', top: 45 },
        { index: 3, itemKey: 'd', top: -50 },
        { index: 4, itemKey: 'e', top: -10 },
        { index: 5, itemKey: 'f', top: -30 },
        { itemKey: 'missing-index', top: 0 },
        { index: 6, itemKey: 'invalid', top: Number.POSITIVE_INFINITY },
        { index: 7, itemKey: 'sticky-top', top: 0 },
        { index: 8, itemKey: 'sticky-bottom', top: 0 },
        { index: 9, itemKey: 'missing-cell', top: 0 },
      ],
    };

    // Older native dispatch supplies the payload itself, without a detail wrapper.
    nestedListBridge().dispatch!(slots(element).worklet!, [detail], undefined, run);

    expect(owner.__listScrollOffset).toEqual({ x: 0, y: 100 });
    expect(owner.__listScrollAnchor).toEqual({ itemKey: 'e', viewportOffset: -10 });
  });

  it.each([false, true])(
    'ignores stale visible-cell identities while preserving a consumer handler: %s',
    hasHandler => {
      const owner = makeOwner();
      const element = elementOf(owner);
      const child = new SnapshotInstance('nested-state-row');
      child.__listItemPlatformInfo = { 'item-key': 'current' };
      owner.insertBefore(child);
      track(owner);
      emit(element, { scrollLeft: 20 });
      const handler: Worklet = { _wkltId: 'consumer-scroll' };
      if (hasHandler) setMainThread(owner, handler);
      const detail = { scrollLeft: 999, attachedCells: [{ index: 0, itemKey: 'previous-owner', left: 0 }] };

      emit(element, detail);

      expect(owner.__listScrollOffset).toEqual({ x: 20, y: 0 });
      if (hasHandler) expect(run).toHaveBeenCalledExactlyOnceWith(handler, [{ detail }], undefined);
      else expect(run).not.toHaveBeenCalled();
    },
  );

  it('treats the deprecated vertical-orientation={false} as a horizontal list', () => {
    const element = __CreateElement('list', 0);
    const owner = makeOwner(element);
    __SetAttribute(element, 'scroll-orientation', undefined);
    __SetAttribute(element, 'vertical-orientation', false);
    const child = new SnapshotInstance('nested-state-row');
    child.__listItemPlatformInfo = { 'item-key': 'h0' };
    owner.insertBefore(child);
    track(owner);

    emit(element, {
      scrollLeft: 40,
      eventSource: 2,
      attachedCells: [{ index: 0, itemKey: 'h0', left: -40, top: 0 }],
    });

    expect(owner.__listScrollAnchor).toEqual({ itemKey: 'h0', viewportOffset: -40 });
  });

  it('restores the stable visible item after variable-width cells move to different indexes', () => {
    const owner = makeOwner();
    const element = elementOf(owner);
    const cells = ['a', 'b', 'c'].map(key => {
      const child = new SnapshotInstance('nested-state-row');
      child.__listItemPlatformInfo = { 'item-key': key };
      owner.insertBefore(child);
      return child;
    });
    track(owner);
    emit(element, {
      scrollLeft: 130,
      eventSource: 2,
      attachedCells: [{ index: 1, itemKey: 'b', left: -30 }, { index: 2, itemKey: 'c', left: 190 }],
    });
    expect(owner.__listScrollAnchor).toEqual({ itemKey: 'b', viewportOffset: -30 });
    owner.insertBefore(cells[2]!, cells[0]);
    updateNestedListChildren(owner, element, owner.childNodes);

    const replacement = __CreateElement('list', 0);
    __SetAttribute(replacement, 'scroll-orientation', 'horizontal');
    destroyNestedListState(__GetElementUniqueID(element));
    owner.__elements = [replacement];
    owner.__element_root = replacement;
    track(owner);
    prepareNestedListRestore(owner)!();

    expect(invoke.mock.calls[0]![2]).toEqual({ position: 2, alignTo: 'top', offset: -30, smooth: false });

    // If the anchor was deleted, fall back to the saved absolute logical offset.
    owner.removeChild(cells[1]!);
    const nextElement = __CreateElement('list', 0);
    destroyNestedListState(__GetElementUniqueID(replacement));
    owner.__elements = [nextElement];
    owner.__element_root = nextElement;
    track(owner);
    prepareNestedListRestore(owner)!();
    expect(invoke.mock.calls[1]![2]).toEqual({ position: 0, alignTo: 'top', offset: -130, smooth: false });
  });

  it('measures only rendered finite positive extents of the active vertical owner', () => {
    const owner = makeOwner();
    const element = elementOf(owner);
    __SetAttribute(element, 'scroll-orientation', 'vertical');
    const children = ['unrendered', 'zero', 'unresolved', 'measured'].map(key => {
      const child = new SnapshotInstance('nested-state-row');
      child.__listItemPlatformInfo = { 'item-key': key };
      owner.insertBefore(child);
      return child;
    });
    for (const child of children.slice(1)) child.ensureElements();
    const read = vi.fn((node: FiberElement, key: string) => {
      if (node === elementOf(children[1]!)) return '0';
      if (node === elementOf(children[2]!)) return 'auto';
      return key === 'height' ? '80' : key === 'margin-top' ? '4' : '6';
    });
    vi.stubGlobal('__GetComputedStyleByKey', read);
    owner.__listScrollOffset = { x: 0, y: 50 };
    track(owner);

    captureNestedListMeasurements(owner);

    expect(children.map(child => child.__listItemMeasuredExtent)).toEqual([undefined, undefined, undefined, 90]);
    expect(getRetainedListItemPlatformInfo(owner, children[3]!)).toEqual({
      'item-key': 'measured',
      'estimated-main-axis-size-px': 90,
    });
    read.mockClear();
    const next = makeOwner(element);
    transferNestedListState(next, element, false);
    read.mockClear();
    captureNestedListMeasurements(owner);
    expect(read).not.toHaveBeenCalled();
  });

  it('keeps estimates unchanged when layout measurement is unavailable or the list has released its elements', () => {
    const owner = makeOwner();
    const child = new SnapshotInstance('nested-state-row');
    child.__listItemPlatformInfo = { 'item-key': 'saved' };
    child.__listItemMeasuredExtent = 120;
    child.__listItemMeasuredOrientation = 'horizontal';
    owner.insertBefore(child);
    owner.__listScrollOffset = { x: 0, y: 0 };
    expect(getRetainedListItemPlatformInfo(owner, child)).toBe(child.__listItemPlatformInfo);
    owner.__listScrollOffset = { x: 0, y: 40 };
    track(owner);
    vi.stubGlobal('__GetComputedStyleByKey', undefined);

    captureNestedListMeasurements(owner);

    expect(child.__listItemMeasuredExtent).toBe(120);
    owner.releaseElements();
    captureNestedListMeasurements(owner);
    expect(getRetainedListItemPlatformInfo(owner, child)).toBe(child.__listItemPlatformInfo);
  });

  it('retains measured extents without overriding consumer estimates or the other axis', () => {
    const owner = makeOwner();
    const element = elementOf(owner);
    const child = new SnapshotInstance('nested-state-row');
    child.__listItemPlatformInfo = { 'item-key': 'measured' };
    owner.insertBefore(child);
    child.ensureElements();
    track(owner);
    emit(element, { scrollLeft: 30, eventSource: 2 });
    captureNestedListMeasurements(owner);

    expect(getRetainedListItemPlatformInfo(owner, child)).toEqual({
      'item-key': 'measured',
      'estimated-main-axis-size-px': 120,
    });
    const explicit = { 'item-key': 'measured', 'estimated-main-axis-size-px': 200 };
    expect(getRetainedListItemPlatformInfo(owner, child, explicit)).toBe(explicit);
    __SetAttribute(element, 'scroll-orientation', 'vertical');
    expect(getRetainedListItemPlatformInfo(owner, child)).toBe(child.__listItemPlatformInfo);
  });
});

describe('nested list events without authored main-thread scripts', () => {
  const runtimeGlobals = ['runWorklet', 'registerWorklet', 'registerWorkletInternal', 'lynxWorkletImpl'] as const;
  let saved: Record<string, unknown>;
  const runner = () => (globalThis as { runWorklet?: (...args: unknown[]) => unknown }).runWorklet;

  beforeEach(() => {
    // A background-only page never evaluates `@lynx-js/react/worklet-runtime/init`.
    saved = {};
    for (const name of runtimeGlobals) {
      saved[name] = (globalThis as Record<string, unknown>)[name];
      delete (globalThis as Record<string, unknown>)[name];
    }
  });

  afterEach(() => {
    for (const name of runtimeGlobals) {
      if (saved[name] === undefined) delete (globalThis as Record<string, unknown>)[name];
      else (globalThis as Record<string, unknown>)[name] = saved[name];
    }
  });

  function fire(element: FiberElement, detail: Record<string, unknown>, name = 'scroll', type = 'bindEvent'): unknown {
    const context = slots(element, name, type).worklet;
    expect(context?._wkltId).toBe(LIST_EVENT_ID);
    // Native and Web resolve the global runner when the event arrives.
    return runner()!(context, [{ detail }]);
  }

  it('records, cancels and restores through the global runner on a cold page', () => {
    const a = makeOwner();
    const element = elementOf(a);
    for (const key of ['a0', 'a1']) {
      const child = new SnapshotInstance('nested-state-row');
      child.__listItemPlatformInfo = { 'item-key': key };
      a.insertBefore(child);
    }
    track(a);

    expect(typeof runner()).toBe('function');
    expect(globalThis.lynxWorkletImpl).toBeUndefined();
    expect((globalThis as Record<string, unknown>)['registerWorklet']).toBeUndefined();
    fire(element, {
      scrollLeft: 150,
      eventSource: 2,
      attachedCells: [{ index: 1, itemKey: 'a1', left: -10 }],
    });
    expect(a.__listScrollOffset).toEqual({ x: 150, y: 0 });
    expect(a.__listScrollAnchor).toEqual({ itemKey: 'a1', viewportOffset: -10 });

    // B receives A's physical list and needs a reset; the user touches first.
    const b = makeOwner(element);
    transferNestedListState(b, element, false);
    const stale = prepareNestedListRestore(b)!;
    fire(element, {}, 'touchstart', 'capture-bind');
    stale();
    expect(invoke).not.toHaveBeenCalled();

    // Returning to A restores its own anchor exactly once.
    updateNestedListChildren(b, element, b.childNodes);
    transferNestedListState(a, element, false);
    updateNestedListChildren(a, element, a.childNodes);
    prepareNestedListRestore(a)!();
    expect(invoke).toHaveBeenCalledExactlyOnceWith(
      element,
      'scrollToPosition',
      { position: 1, alignTo: 'top', offset: -10, smooth: false },
      expect.any(Function),
    );
    expect(prepareNestedListRestore(a)).toBeUndefined();
  });

  it('keeps the fallback inert for every other main-thread context', () => {
    track(makeOwner());

    expect(runner()!({ _wkltId: 'authored-but-unloaded' }, [{}])).toBeUndefined();
    expect(runner()!(null, [])).toBeUndefined();
    expect(globalThis.lynxWorkletImpl).toBeUndefined();
  });

  it.each(['flat', '__InvokeUIMethod', '__GetAttributeByName'])('does not install a runner for a %s list', kind => {
    if (kind === 'flat') {
      const owner = new SnapshotInstance('nested-state-list');
      const element = __CreateElement('list', 0);
      owner.__elements = [element];
      owner.__element_root = element;
      track(owner);
    } else {
      vi.stubGlobal(kind, undefined);
      track(makeOwner());
    }

    expect(runner()).toBeUndefined();
  });

  it('leaves an initialized worklet runtime and its registry untouched', () => {
    initWorklet();
    const before = {
      runWorklet: runner(),
      registerWorklet: (globalThis as Record<string, unknown>)['registerWorklet'],
      impl: globalThis.lynxWorkletImpl,
    };
    const owner = makeOwner();
    track(owner);

    expect(runner()).toBe(before.runWorklet);
    expect((globalThis as Record<string, unknown>)['registerWorklet']).toBe(before.registerWorklet);
    expect(globalThis.lynxWorkletImpl).toBe(before.impl);
    fire(elementOf(owner), { scrollLeft: 12, eventSource: 2 });
    expect(owner.__listScrollOffset).toEqual({ x: 12, y: 0 });
  });

  it('keeps old proxies and consumer results after a later main-thread bundle initializes', () => {
    const owner = makeOwner();
    const element = elementOf(owner);
    track(owner);
    const fallback = runner();
    const coldProxy = slots(element).worklet!;

    initWorklet();
    expect(runner()).not.toBe(fallback);
    const consumer = vi.fn((event: { stopPropagation: () => void }) => {
      event.stopPropagation();
      return 'handled';
    });
    globalThis.registerWorklet('main-thread', 'late-scroll', consumer);
    setMainThread(owner, { _wkltId: 'late-scroll' });

    const params = [{ detail: { scrollLeft: 64, eventSource: 2 } }];
    expect(runner()!(coldProxy, params, { source: RunWorkletSource.EVENT })).toEqual({
      returnValue: 'handled',
      eventReturnResult: EventResult.kStopPropagationMask,
    });
    expect(owner.__listScrollOffset).toEqual({ x: 64, y: 0 });
    expect(consumer).toHaveBeenCalledOnce();
    expect(consumer.mock.calls[0]![0]).toBe(params[0]);
  });

  it('reads the current dispatcher without replacing a runner installed later', () => {
    const owner = makeOwner();
    track(owner);
    const previous = nestedListBridge().dispatch!;
    const next = vi.fn(() => 'next');
    try {
      setListEventDispatch(next);
      expect(fire(elementOf(owner), { scrollLeft: 1 })).toBe('next');
      expect(next).toHaveBeenCalledOnce();

      const later = vi.fn();
      (globalThis as Record<string, unknown>)['runWorklet'] = later;
      setListEventDispatch(previous);
      expect(runner()).toBe(later);
    } finally {
      setListEventDispatch(previous);
    }
  });

  it('is ready before native list setup can synchronously emit', () => {
    const owner = makeOwner();
    const element = elementOf(owner);
    const setAttribute = globalThis.__SetAttribute;
    vi.stubGlobal('__SetAttribute', (target: FiberElement, key: string, value: unknown) => {
      setAttribute(target, key, value);
      if (target === element && key === 'needs-visible-cells') {
        runner()!({
          _wkltId: LIST_EVENT_ID,
          listID: __GetElementUniqueID(element),
          eventType: 'bindEvent',
          eventName: 'scroll',
        }, [{ detail: { scrollLeft: 30, eventSource: 2 } }]);
      }
    });

    track(owner);
    expect(owner.__listScrollOffset).toEqual({ x: 30, y: 0 });
  });

  it('dispatches through a separately bundled worklet runtime', async () => {
    vi.resetModules();
    const bundled = await import('../../src/worklet-runtime/workletRuntime');
    bundled.initWorklet();
    const consumer = vi.fn(() => 'handled');
    globalThis.registerWorklet('main-thread', 'bundled-scroll', consumer);
    const owner = makeOwner();
    track(owner);
    setMainThread(owner, { _wkltId: 'bundled-scroll' });

    expect(fire(elementOf(owner), { scrollLeft: 10, eventSource: 2 })).toBe('handled');
    expect(owner.__listScrollOffset).toEqual({ x: 10, y: 0 });
    expect(consumer).toHaveBeenCalledOnce();
  });

  it('forwards legacy first-screen handlers into the real delayed-event queue', () => {
    initWorklet();
    const owner = makeOwner();
    const element = elementOf(owner);
    owner.__elements = undefined;
    owner.__element_root = undefined;
    const legacy: Worklet = { _lepusWorkletHash: 'legacy-nested-scroll' } as unknown as Worklet;
    owner.__values = [undefined, legacy];
    updateWorkletEvent(owner, 1, undefined as unknown as Worklet, 0, 'main-thread', 'bindEvent', 'scroll');
    owner.__elements = [element];
    owner.__element_root = element;
    track(owner);

    const params = [{ detail: { scrollLeft: 18, eventSource: 2 } }];
    runner()!(slots(element).worklet, params);

    expect(owner.__listScrollOffset).toEqual({ x: 18, y: 0 });
    expect(globalThis.lynxWorkletImpl._eventDelayImpl._delayedWorkletParamsMap.get('legacy-nested-scroll'))
      .toEqual([params]);
    expect(globalThis.lynxWorkletImpl._eventDelayImpl._delayedWorkletParamsMap.get('legacy-nested-scroll')![0])
      .toBe(params);
  });
});

describe('nested list events in a single native worklet slot per event name', () => {
  // Native keeps one main-thread handler per element and event name, whatever
  // its type; background handlers live in a separate map.
  const worklets = new Map<FiberElement, Map<string, { type: string; value: Worklet }>>();
  const backgrounds = new Map<FiberElement, Map<string, string>>();

  beforeEach(() => {
    worklets.clear();
    backgrounds.clear();
    vi.stubGlobal('__AddEvent', (
      element: FiberElement,
      type: string,
      name: string,
      handler: string | { type: string; value: Worklet } | undefined,
    ) => {
      if (handler === undefined) {
        backgrounds.get(element)?.delete(`${type}:${name}`);
        return;
      }
      if (typeof handler === 'string') {
        if (!backgrounds.has(element)) backgrounds.set(element, new Map());
        backgrounds.get(element)!.set(`${type}:${name}`, handler);
        return;
      }
      if (!worklets.has(element)) worklets.set(element, new Map());
      worklets.get(element)!.set(name, { type, value: handler.value });
    });
  });

  function slot(element: FiberElement, name: string) {
    return worklets.get(element)?.get(name);
  }

  function fireSlot(element: FiberElement, name: string, detail: Record<string, unknown>): unknown {
    const current = slot(element, name)!;
    expect(current.value._wkltId).toBe(LIST_EVENT_ID);
    return nestedListBridge().dispatch!(current.value, [{ detail }], undefined, run);
  }

  it('keeps scroll tracking after a consumer main-thread catch handler is removed', () => {
    const owner = makeOwner();
    const element = elementOf(owner);
    track(owner);
    const handler: Worklet = { _wkltId: 'consumer-catch-scroll' };
    setMainThread(owner, handler, 'catchEvent', 'scroll');
    expect(slot(element, 'scroll')!.type).toBe('catchEvent');
    fireSlot(element, 'scroll', { scrollLeft: 30, eventSource: 2 });
    expect(run).toHaveBeenCalledExactlyOnceWith(handler, [{ detail: { scrollLeft: 30, eventSource: 2 } }], undefined);

    setMainThread(owner, undefined, 'catchEvent', 'scroll');
    run.mockClear();

    expect(slot(element, 'scroll')!.type).toBe('bindEvent');
    fireSlot(element, 'scroll', { scrollLeft: 50, eventSource: 2 });
    expect(owner.__listScrollOffset).toEqual({ x: 50, y: 0 });
    expect(run).not.toHaveBeenCalled();
  });

  it('keeps a consumer main-thread handler when a background handler of another type is cleared', () => {
    const owner = makeOwner();
    const element = elementOf(owner);
    track(owner);
    const handler: Worklet = { _wkltId: 'consumer-catch-scroll' };
    setMainThread(owner, handler, 'catchEvent', 'scroll');
    setBackground(owner, () => {}, 'bindEvent', 'scroll');

    setBackground(owner, undefined, 'bindEvent', 'scroll');

    expect(slot(element, 'scroll')!.type).toBe('catchEvent');
    fireSlot(element, 'scroll', { scrollLeft: 12, eventSource: 2 });
    expect(run).toHaveBeenCalledExactlyOnceWith(handler, [{ detail: { scrollLeft: 12, eventSource: 2 } }], undefined);
  });

  it('restores the capture-phase touch proxy after a consumer bind handler is removed', () => {
    const before = makeOwner();
    const element = elementOf(before);
    track(before);
    setMainThread(before, { _wkltId: 'consumer-touch' }, 'bindEvent', 'touchstart');
    setMainThread(before, undefined, 'bindEvent', 'touchstart');
    expect(slot(element, 'touchstart')!.type).toBe('capture-bind');

    const after = makeOwner(element);
    transferNestedListState(after, element, false);
    const restore = prepareNestedListRestore(after)!;
    fireSlot(element, 'touchstart', {});
    restore();
    expect(invoke).not.toHaveBeenCalled();
  });
});
