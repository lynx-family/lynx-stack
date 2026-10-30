// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { globalEnvManager } from './utils/envManager';
import { elementTree, parentMap } from './utils/nativeMethod';
import { applyNodesRefRemoveChild } from '../../src/snapshot/lifecycle/patch/nodesRefApply';
import { clearListGlobal, componentAtIndexFactory, gRecycleMap, gSignMap } from '../../src/snapshot/list/list';
import { ListUpdateInfoRecording } from '../../src/snapshot/list/listUpdateInfo';
import {
  isNestedListReuse,
  prepareNestedListRestore,
  transferNestedListState,
  updateNestedListChildren,
} from '../../src/snapshot/list/nativeState';
import { __pendingListUpdates } from '../../src/snapshot/list/pendingListUpdates';
import { hydrate } from '../../src/snapshot/renderToOpcodes/hydrate';
import { __OpAttr, __OpBegin, __OpEnd } from '../../src/snapshot/renderToOpcodes/index';
import { ssrHydrateByOpcodes } from '../../src/snapshot/renderToOpcodes/opcodes';
import { snapshotManager } from '../../src/snapshot/snapshot/definition';
import { DynamicPartType } from '../../src/snapshot/snapshot/dynamicPartType';
import { snapshotCreateList, snapshotDestroyList, snapshotInitializeList } from '../../src/snapshot/snapshot/list';
import { SnapshotInstance, snapshotInstanceManager } from '../../src/snapshot/snapshot/snapshot';
import { Element, setShouldFlush } from '../../src/worklet-runtime/api/element';
import { nestedListBridge } from '../../src/worklet-runtime/listEvent';

const LIST = 'nested-lifecycle-list';
const ROW = 'nested-lifecycle-row';
type TestElement = ReturnType<typeof elementTree.__CreateElement>;
const invoke = vi.fn();

function mockInlineStyles() {
  const raw = new Map<FiberElement, string>();
  const properties = new Map<FiberElement, Map<string | number, unknown>>();
  const frames: (() => void)[] = [];
  setShouldFlush(false);
  vi.stubGlobal('lynx', { ...lynx, requestAnimationFrame: (callback: () => void) => frames.push(callback) });
  vi.stubGlobal('__GetInlineStyles', (element: FiberElement) => raw.get(element) ?? '');
  vi.stubGlobal('__GetInlineStyle', (element: FiberElement, key: number) => properties.get(element)?.get(key));
  const writeRaw = vi.fn((element: FiberElement, value: string) => raw.set(element, value));
  vi.stubGlobal('__SetInlineStyles', writeRaw);
  vi.stubGlobal('__AddInlineStyle', (element: FiberElement, key: string | number, value: unknown) => {
    let styles = properties.get(element);
    if (!styles) properties.set(element, styles = new Map());
    if (value == null) styles.delete(key);
    else styles.set(key, value);
  });
  vi.stubGlobal('__NextElement', (element: TestElement) => {
    const parent = parentMap.get(element);
    return parent?.children[parent.children.indexOf(element) + 1];
  });
  const animate = vi.fn();
  vi.stubGlobal('__ElementAnimate', animate);
  snapshotManager.values.set(ROW, {
    ...snapshotManager.values.get(ROW)!,
    update: [(owner, index) => __SetInlineStyles(owner.__elements![0]!, owner.__values![index])],
  });
  return { raw, properties, frames, writeRaw, animate };
}

function node(type = ROW, children: SnapshotInstance[] = []): SnapshotInstance {
  const snapshot = new SnapshotInstance(type);
  for (const child of children) snapshot.__insertBefore(child);
  return snapshot;
}

function list(children: SnapshotInstance[] = []): SnapshotInstance {
  return node(LIST, children);
}

function elementOf(snapshot: SnapshotInstance): TestElement {
  return snapshot.__element_root! as TestElement;
}

function bind(owner: SnapshotInstance, index = 0): number {
  return elementTree.triggerComponentAtIndex(elementOf(owner), index, 1, false);
}

function emit(owner: SnapshotInstance, itemKey: string, x: number, index = 0): void {
  nestedListBridge().dispatch!(
    {
      listID: __GetElementUniqueID(elementOf(owner)),
      eventType: 'bindEvent',
      eventName: 'scroll',
      _wkltId: '',
    },
    [{ detail: { eventSource: 2, scrollLeft: x, attachedCells: [{ index, itemKey, left: -3 }] } }],
    undefined,
    () => {},
  );
}

function keyedRow(key: string, children: SnapshotInstance[] = []): SnapshotInstance {
  const row = node(ROW, children);
  row.__listItemPlatformInfo = { 'item-key': key };
  return row;
}

function pendingRow(key: string, offset: number): { row: SnapshotInstance; inner: SnapshotInstance } {
  const inner = list();
  inner.__listScrollOffset = { x: offset, y: 0 };
  return { row: keyedRow(key, [inner]), inner };
}

function expectCounts(snapshot: SnapshotInstance): number {
  const descendants = snapshot.childNodes.reduce((total, child) => total + expectCounts(child), 0);
  expect(snapshot.__listDescendantCount ?? 0).toBe(descendants);
  return descendants + Number(Boolean(snapshot.__snapshot_def?.isListHolder));
}

function threeLevelList() {
  const leaf = list();
  const middleRow = keyedRow('middle-cell', [leaf]);
  const middle = list([middleRow]);
  const row = keyedRow('outer-cell', [middle]);
  const outer = list([row]);
  const wrapper = node(ROW, [outer]);
  wrapper.ensureElements();
  const outerSign = bind(outer);
  const middleSign = bind(middle);
  elementTree.triggerEnqueueComponent(elementOf(outer), outerSign);
  elementTree.triggerEnqueueComponent(elementOf(middle), middleSign);
  return { wrapper, outer, middle, leaf, lists: [outer, middle, leaf] };
}

beforeEach(() => {
  globalEnvManager.resetEnv();
  elementTree.clear();
  __pendingListUpdates.values = {};
  snapshotManager.values.set(LIST, {
    create: owner => [snapshotCreateList(0, owner, 0)],
    update: [],
    slot: [[DynamicPartType.ListChildren, 0]],
    isListHolder: true,
  });
  snapshotManager.values.set(ROW, {
    create: () => [__CreateElement('list-item', 0)],
    update: [],
    slot: [[DynamicPartType.Children, 0]],
  });
  invoke.mockReset();
  invoke.mockImplementation((_element, _method, _params, done) => done({ code: 0 }));
  vi.stubGlobal('__InvokeUIMethod', invoke);
  vi.stubGlobal('__GetComputedStyleByKey', (_element: FiberElement, key: string) => key === 'width' ? '100' : '0');
});

afterEach(() => {
  setShouldFlush(true);
  // Restore accessor spies before normal list teardown traverses the fixtures.
  vi.restoreAllMocks();
  for (const snapshot of snapshotInstanceManager.values.values()) {
    if (snapshot.__snapshot_def?.isListHolder && snapshot.__elements) snapshotDestroyList(snapshot);
  }
  vi.unstubAllGlobals();
  __pendingListUpdates.values = {};
  globalEnvManager.resetEnv();
  elementTree.clear();
});

describe('nested list logical subtree accounting', () => {
  it('keeps counts exact through reparenting, reordering, removal and rendered clones', () => {
    const left = node();
    const right = node();
    const root = node(ROW, [left, right]);
    const nested = list([node(ROW, [list()])]);
    left.__insertBefore(nested);
    expect(expectCounts(root)).toBe(2);

    right.__insertBefore(nested);
    const sibling = list();
    right.__insertBefore(sibling);
    right.__insertBefore(nested, sibling);
    expect(right.childNodes).toEqual([nested, sibling]);
    expect(left.__listDescendantCount).toBe(0);
    expect(expectCounts(root)).toBe(3);

    right.__removeChild(nested);
    expect(expectCounts(root)).toBe(1);
    left.__insertBefore(nested);
    root.ensureElements();
    const retained = root.takeElements();
    expect(expectCounts(root)).toBe(3);
    expect(expectCounts(retained)).toBe(3);
    retained.releaseElements();
  });

  it('does not read ancestor counters for flat edits and accepts the Suspense virtual div', () => {
    const branch = node();
    const root = node(ROW, [branch]);
    const readCount = vi.fn(() => {
      throw new Error('flat edit walked an ancestor');
    });
    Object.defineProperty(root, '__listDescendantCount', { get: readCount, configurable: true });
    const plain = node();
    branch.__insertBefore(plain);
    branch.__removeChild(plain);
    expect(readCount).not.toHaveBeenCalled();
    delete root.__listDescendantCount;

    const suspense = new SnapshotInstance('div');
    expect(suspense.__snapshot_def).toBeUndefined();
    suspense.__insertBefore(list());
    branch.__insertBefore(suspense);
    expect(expectCounts(root)).toBe(1);
    branch.__removeChild(suspense);
    expect(expectCounts(root)).toBe(0);
  });

  it('keeps flat binds constant work on a page with pending nested lists', () => {
    const inner = list();
    list([inner]);
    inner.__listScrollOffset = { x: 10, y: 0 };
    inner.ensureElements();
    const flat = node(ROW, Array.from({ length: 100 }, () => node()));
    const children = vi.spyOn(flat, 'childNodes', 'get');
    children.mockImplementation(() => {
      throw new Error('flat bind materialized children');
    });
    expect(isNestedListReuse(-1, flat)).toBe(false);
    expect(prepareNestedListRestore(flat)).toBeUndefined();
    expect(children).not.toHaveBeenCalled();

    const lazy = node(ROW, [node(ROW, [list()])]);
    expect(isNestedListReuse(-1, lazy)).toBe(true);
    expect(lazy.childNodes[0]!.childNodes[0]!.__elements).toBeUndefined();
  });

  it('does not look up native identity when publishing callbacks on an all-flat page', () => {
    const owner = list();
    const element = __CreateElement('list', 0);
    const identity = vi.spyOn(globalThis, '__GetElementUniqueID');
    updateNestedListChildren(owner, element, []);
    expect(identity).not.toHaveBeenCalled();
  });

  it('prepares only each requested subtree without walking unrelated pending owners', () => {
    const rows = Array.from({ length: 40 }, (_, index) => pendingRow(`cell-${index}`, index + 1));
    const outer = list(rows.map(({ row }) => row));
    const ancestry = rows.map(({ inner }) => {
      inner.ensureElements();
      return vi.spyOn(inner, 'parentNode', 'get');
    });
    const completions = rows.map(({ row }) => prepareNestedListRestore(row));
    expect(prepareNestedListRestore(node())).toBeUndefined();
    for (const reads of ancestry) expect(reads).not.toHaveBeenCalled();
    for (const complete of completions) complete!();
    expect(invoke).toHaveBeenCalledTimes(rows.length);
    expect(outer.__listDescendantCount).toBe(rows.length);
  });

  it('restores parent lists before descendants even when SSR adopts the child first', () => {
    const inner = list();
    const parent = list([node(ROW, [inner])]);
    const outer = list([node(ROW, [parent])]);
    parent.__listScrollOffset = { x: 10, y: 0 };
    inner.__listScrollOffset = { x: 20, y: 0 };
    for (const owner of [inner, parent]) {
      owner.__elements = [__CreateElement('list', 0)];
      owner.__element_root = owner.__elements[0];
      snapshotInitializeList(owner, elementOf(owner), owner.childNodes);
    }

    const restore = prepareNestedListRestore(outer)!;
    restore();
    restore();
    expect(invoke.mock.calls.map(([element]) => element)).toEqual([elementOf(parent), elementOf(inner)]);
    expect(prepareNestedListRestore(outer)).toBeUndefined();
  });
});

describe('nested list physical cache teardown', () => {
  it('transfers rendered pooled and visible children without publishing lazy children as native cache entries', () => {
    const pooled = keyedRow('pooled');
    const visible = keyedRow('visible');
    for (const child of [pooled, visible]) child.__listItemPlatformInfo!['reuse-identifier'] = 'group';
    const plain = node();
    const lazy = keyedRow('lazy');
    const owner = list([pooled, visible, plain, lazy]);
    owner.ensureElements();
    const signs = [bind(owner, 0), bind(owner, 1), bind(owner, 2)];
    elementTree.triggerEnqueueComponent(elementOf(owner), signs[0]!);
    const native = elementOf(owner);
    const listID = __GetElementUniqueID(native);

    const retained = owner.takeElements();
    const children = retained.childNodes;

    expect(owner.__elements).toBeUndefined();
    expect(children.map(child => child.type)).toEqual([ROW, ROW, ROW, ROW]);
    expect(signs.map(sign => gSignMap[listID]!.get(sign))).toEqual(children.slice(0, 3));
    expect(gRecycleMap[listID]!.get(`${ROW}group`)!.get(signs[0]!)).toBe(children[0]);
    expect(gRecycleMap[listID]!.get(`${ROW}group`)!.has(signs[1]!)).toBe(false);
    expect(gRecycleMap[listID]!.has(ROW)).toBe(false);
    expect(children[3]!.__element_root).toBeUndefined();
    expect(bind(retained, 0)).toBe(signs[0]);
    expect(gRecycleMap[listID]!.get(`${ROW}group`)!.has(signs[0]!)).toBe(false);
    retained.releaseElements();
  });

  it('does not reinstall destroyed list callbacks when its remaining logical tree is cloned', () => {
    const child = keyedRow('destroyed-child');
    const owner = list([child]);
    owner.ensureElements();
    bind(owner);
    const native = elementOf(owner);
    const listID = __GetElementUniqueID(native);
    snapshotDestroyList(owner);
    const callbacks = vi.spyOn(globalThis, '__UpdateListCallbacks');

    const retained = owner.takeElements();

    expect(elementOf(retained)).toBe(native);
    expect(retained.childNodes[0]!.__element_root).toBeDefined();
    expect(callbacks).not.toHaveBeenCalled();
    expect(gSignMap[listID]).toBeUndefined();
    expect(gRecycleMap[listID]).toBeUndefined();
    expect(bind(retained)).toBe(-1);
    retained.releaseElements();
  });

  it('keeps a flat moved cell in its original reuse group with an independent values array', () => {
    const logical = new SnapshotInstance('view');
    const originalProps = { id: 'flat-original', style: 'height:40px;' };
    logical.__values = [originalProps];
    const owner = list([logical]);
    owner.ensureElements();
    const oldSign = bind(owner);
    const oldRoot = elementOf(logical);

    const currentSign = bind(owner);
    const retained = gSignMap[__GetElementUniqueID(elementOf(owner))]!.get(oldSign)!;
    expect(currentSign).not.toBe(oldSign);
    expect(retained.type).toBe('view');
    expect(retained.__values).not.toBe(logical.__values);
    retained.setAttribute(0, { id: 'flat-retained', style: 'height:80px;' });
    expect(logical.__values).toEqual([originalProps]);
    expect(elementOf(retained)).toBe(oldRoot);
    expect(elementOf(logical)).not.toBe(oldRoot);
    elementTree.triggerEnqueueComponent(elementOf(owner), oldSign);
    expect(gRecycleMap[__GetElementUniqueID(elementOf(owner))]!.get('view')!.get(oldSign)).toBe(retained);
    expect(gRecycleMap[__GetElementUniqueID(elementOf(owner))]!.has('undefined')).toBe(false);
  });

  it('destroys cached-only nested lists once without unregistering logical snapshots', () => {
    const inner = list();
    const row = keyedRow('moving-cell', [inner]);
    const outer = list([row]);
    outer.ensureElements();
    const oldSign = bind(outer);
    const oldInner = elementOf(inner);
    // Requesting an already visible cell retains its old physical tree in the
    // sign map and renders the logical item again under a different native sign.
    const newSign = bind(outer);
    expect(newSign).not.toBe(oldSign);
    elementTree.triggerEnqueueComponent(elementOf(outer), oldSign);
    const cached = gSignMap[__GetElementUniqueID(elementOf(outer))]!.get(oldSign)!;
    expect(cached).not.toBe(row);
    expect(cached.childNodes[0]!.__element_root).toBe(oldInner);
    const logical = new Map(snapshotInstanceManager.values);
    const callbacks = vi.spyOn(globalThis, '__UpdateListCallbacks');

    snapshotDestroyList(outer);

    expect(callbacks.mock.calls.filter(([element]) => element === oldInner)).toHaveLength(1);
    expect(gSignMap[__GetElementUniqueID(oldInner)]).toBeUndefined();
    expect(gRecycleMap[__GetElementUniqueID(oldInner)]).toBeUndefined();
    expect(snapshotInstanceManager.values).toEqual(logical);
    const native = lynx.getNative()!;
    const registrations = vi.mocked(native.addEventListener).mock.calls;
    expect(vi.mocked(native.removeEventListener).mock.calls).toHaveLength(registrations.length);
    for (const [name, listener] of registrations) {
      expect(native.removeEventListener).toHaveBeenCalledWith(name, listener);
    }
  });

  it('does not tear down a transferred live owner through an old cached row', () => {
    const inner = list();
    const row = keyedRow('old-row', [inner]);
    const outer = list([row]);
    outer.ensureElements();
    bind(outer);
    const nativeInner = elementOf(inner);
    const retained = row.takeElements();
    const liveInner = retained.childNodes[0]!;
    const callbacks = vi.spyOn(globalThis, '__UpdateListCallbacks');

    snapshotDestroyList(outer);

    expect(callbacks.mock.calls.some(([element]) => element === nativeInner)).toBe(false);
    expect(gSignMap[__GetElementUniqueID(nativeInner)]).toBeDefined();
    expect(snapshotInstanceManager.values.get(inner.__id)).toBe(inner);
    snapshotDestroyList(liveInner);
    expect(callbacks.mock.calls.filter(([element]) => element === nativeInner)).toHaveLength(1);
    expect(gSignMap[__GetElementUniqueID(nativeInner)]).toBeUndefined();
  });

  it.each(['release', 'remove', 'portal'] as const)(
    'deduplicates overlapping logical/cached three-level lists during %s',
    kind => {
      const { wrapper, lists } = threeLevelList();
      const nativeLists = lists.map(elementOf);
      const ids = nativeLists.map(element => __GetElementUniqueID(element));
      const callbacks = vi.spyOn(globalThis, '__UpdateListCallbacks');
      if (kind === 'release') {
        wrapper.releaseElements();
      } else if (kind === 'remove') {
        const parent = node();
        parent.ensureElements();
        parent.insertBefore(wrapper);
        parent.removeChild(wrapper);
        expect(parent.__listDescendantCount).toBe(0);
      } else {
        vi.stubGlobal('__GetPageElement', () => undefined);
        applyNodesRefRemoveChild('#removed-host', wrapper);
        expect(snapshotInstanceManager.values.has(wrapper.__id)).toBe(false);
      }
      expect(callbacks.mock.calls.map(([element]) => element)).toEqual(nativeLists);
      for (const id of ids) {
        expect(gSignMap[id]).toBeUndefined();
        expect(gRecycleMap[id]).toBeUndefined();
      }
      expect(wrapper.__elements).toBeUndefined();
    },
  );
});

describe('nested list callback data-source publication', () => {
  it('updates adopted Slot root aliases through multiple ancestors while retaining the native cell sign', () => {
    const ALIAS = 'nested-lifecycle-slot-alias';
    const SLOT_ROW = 'nested-lifecycle-slot-row';
    snapshotManager.values.set(ALIAS, {
      create: () => [__CreateWrapperElement(0)],
      update: [],
      slot: [[DynamicPartType.Slot, 0]],
    });
    snapshotManager.values.set(SLOT_ROW, {
      create: () => {
        const root = __CreateElement('list-item', 0);
        const placeholder = __CreateWrapperElement(0);
        __AppendElement(root, placeholder);
        return [root, placeholder];
      },
      update: [],
      slot: [[DynamicPartType.Slot, 1]],
    });
    const nativeOuter = __CreateElement('list', 0) as TestElement;
    const nativeRow = __CreateElement('list-item', 0) as TestElement;
    const oldInner = __CreateElement('list', 0);
    __AppendElement(nativeOuter, nativeRow);
    __AppendElement(nativeRow, oldInner);
    __SetAttribute(nativeRow, 'stable-marker', 'retained');
    const root = new SnapshotInstance('root');
    // Adopt shared template-part references with the real SSR decoder. Both
    // Slot-only snapshots refer to the same native root as the inner list.
    ssrHydrateByOpcodes(
      [
        __OpBegin,
        [LIST, 1000, [{ ssrID: 'outer' }]],
        0,
        __OpBegin,
        [SLOT_ROW, 1001, [{ ssrID: 'row' }, { ssrID: 'inner' }]],
        0,
        __OpAttr,
        '__listItemPlatformInfo',
        { 'item-key': 'before' },
        __OpBegin,
        [ALIAS, 1002, [{ ssrID: 'inner' }]],
        0,
        __OpBegin,
        [ALIAS, 1003, [{ ssrID: 'inner' }]],
        0,
        __OpBegin,
        [LIST, 1004, [{ ssrID: 'inner' }]],
        0,
        __OpEnd,
        __OpEnd,
        __OpEnd,
        __OpEnd,
        __OpEnd,
      ],
      root,
      { outer: nativeOuter, row: nativeRow, inner: oldInner },
    );
    const owner = root.childNodes[0]!;
    const beforeRow = owner.childNodes[0]!;
    expect(beforeRow.childNodes[0]!.__element_root).toBe(oldInner);
    expect(beforeRow.childNodes[0]!.childNodes[0]!.__element_root).toBe(oldInner);
    const afterInner = list([keyedRow('fresh-child')]);
    afterInner.__listScrollOffset = { x: 30, y: 0 };
    const innerAlias = node(ALIAS, [afterInner]);
    const outerAlias = node(ALIAS, [innerAlias]);
    const afterRow = node(SLOT_ROW, [outerAlias]);
    afterRow.__listItemPlatformInfo = { 'item-key': 'after' };
    __pendingListUpdates.clearAttachedLists();
    owner.insertBefore(afterRow);
    __pendingListUpdates.flush();
    const replace = vi.spyOn(globalThis, '__ReplaceElement');
    const sign = __GetElementUniqueID(nativeRow);

    expect(bind(owner, 1)).toBe(sign);

    const fresh = elementOf(afterInner);
    expect(fresh).not.toBe(oldInner);
    expect(replace).toHaveBeenCalledExactlyOnceWith(fresh, oldInner);
    for (const alias of [innerAlias, outerAlias]) {
      expect(alias.__elements).toEqual([fresh]);
      expect(alias.__element_root).toBe(fresh);
    }
    expect(afterRow.__elements).toEqual([nativeRow, fresh]);
    expect(afterRow.__element_root).toBe(nativeRow);
    expect(nativeOuter.children).toEqual([nativeRow]);
    expect(nativeRow.children).toEqual([fresh]);
    expect(nativeRow.props['stable-marker']).toBe('retained');
    expect(gSignMap[__GetElementUniqueID(nativeOuter)]!.get(sign)).toBe(afterRow);
    expect(gSignMap[__GetElementUniqueID(oldInner)]).toBeUndefined();
    expect(gRecycleMap[__GetElementUniqueID(oldInner)]).toBeUndefined();
  });

  it('keeps committed indices through uncommitted edits and ignores stale publishers after transfer', () => {
    const old = keyedRow('old');
    const owner = list([old]);
    list([owner]);
    owner.ensureElements();
    __SetAttribute(elementOf(owner), 'scroll-orientation', 'horizontal');
    owner.__insertBefore(keyedRow('inserted'), old);
    emit(owner, 'old', 21);
    expect(owner.__listScrollAnchor?.itemKey).toBe('old');

    const next = keyedRow('next');
    const receiver = list([next]);
    list([receiver]);
    receiver.__elements = owner.__elements;
    receiver.__element_root = owner.__element_root;
    transferNestedListState(receiver, elementOf(owner), true);
    updateNestedListChildren(receiver, elementOf(owner), [next]);
    updateNestedListChildren(owner, elementOf(owner), [old]);
    emit(receiver, 'next', 31);
    emit(receiver, 'old', 99);
    expect(receiver.__listScrollAnchor?.itemKey).toBe('next');
    expect(receiver.__listScrollOffset).toEqual({ x: 31, y: 0 });
  });

  it('publishes adopted children before a native configuration setter reenters scroll', () => {
    const child = keyedRow('ssr-cell');
    const owner = list([child]);
    list([owner]);
    owner.__elements = [__CreateElement('list', 0)];
    owner.__element_root = owner.__elements[0];
    __SetAttribute(elementOf(owner), 'scroll-orientation', 'horizontal');
    // The adopted native element can already carry the framework proxy. Its
    // second initialization must publish the new source before native setters.
    snapshotInitializeList(owner, elementOf(owner), []);
    const setAttribute = globalThis.__SetAttribute;
    vi.spyOn(globalThis, '__SetAttribute').mockImplementation((element, key, value) => {
      setAttribute(element, key, value);
      if (element === elementOf(owner) && key === 'needs-visible-cells') emit(owner, 'ssr-cell', 19);
    });

    snapshotInitializeList(owner, elementOf(owner), [child]);

    expect(owner.__listScrollAnchor).toEqual({ itemKey: 'ssr-cell', viewportOffset: -3 });
    expect(owner.__listScrollOffset).toEqual({ x: 19, y: 0 });
  });

  it('uses the committed source on scroll without materializing 10000 logical children', () => {
    const children = Array.from({ length: 10000 }, (_, index) => keyedRow(`cell-${index}`));
    const owner = list(children);
    list([owner]);
    owner.ensureElements();
    __SetAttribute(elementOf(owner), 'scroll-orientation', 'horizontal');
    const reads = vi.spyOn(owner, 'childNodes', 'get');
    reads.mockImplementation(() => {
      throw new Error('scroll copied the logical source');
    });

    for (let index = 0; index < 3; index++) emit(owner, 'cell-9999', 20 + index, 9999);

    expect(reads).not.toHaveBeenCalled();
    expect(owner.__listScrollAnchor?.itemKey).toBe('cell-9999');
    expect(owner.__listScrollOffset?.x).toBe(22);
  });

  it('shares one new callback source before update-list-info can reenter', () => {
    const old = keyedRow('old');
    const owner = list([old]);
    list([owner]);
    owner.ensureElements();
    __SetAttribute(elementOf(owner), 'scroll-orientation', 'horizontal');
    const update = new ListUpdateInfoRecording(owner);
    const fresh = keyedRow('new');
    update.onRemoveChild(old);
    owner.__removeChild(old);
    update.onInsertBefore(fresh);
    owner.__insertBefore(fresh);
    const reads = vi.spyOn(owner, 'childNodes', 'get');
    const setAttribute = globalThis.__SetAttribute;
    vi.spyOn(globalThis, '__SetAttribute').mockImplementation((element, key, value) => {
      setAttribute(element, key, value);
      if (key !== 'update-list-info') return;
      emit(owner, 'old', 999);
      expect(owner.__listScrollOffset).toBeUndefined();
      emit(owner, 'new', 27);
    });

    update.flush();

    expect(reads).toHaveBeenCalledTimes(1);
    expect(owner.__listScrollAnchor?.itemKey).toBe('new');
    expect(owner.__listScrollOffset?.x).toBe(27);
  });
});

describe('native list bind completion barriers', () => {
  it('suppresses cross-owner cell binds for one frame while preserving same-item expansion and later MTS writes', () => {
    const { raw, properties, frames, writeRaw, animate } = mockInlineStyles();
    snapshotManager.values.set(LIST, {
      ...snapshotManager.values.get(LIST)!,
      create: owner => {
        const element = snapshotCreateList(0, owner, 0);
        __SetAttribute(element, 'scroll-orientation', 'horizontal');
        return [element];
      },
    });
    const a = pendingRow('a', 80);
    const b = pendingRow('b', 40);
    const measuredAChild = keyedRow('a-child');
    a.inner.__insertBefore(measuredAChild);
    const styleA = 'height:100px;transition:height 300ms;';
    const styleB = 'height:120px;transition:height 300ms;';
    a.row.__values = [styleA];
    b.row.__values = [styleB];
    const outer = list([a.row, b.row]);
    outer.ensureElements();
    const sign = bind(outer, 0);
    const root = elementOf(a.row);
    bind(a.inner, 0);
    emit(a.inner, 'a-child', 80);
    expect(measuredAChild.__listItemMeasuredExtent).toBeUndefined();
    expect(raw.get(root)).toBe(styleA);
    expect(frames).toHaveLength(0);

    elementTree.triggerEnqueueComponent(elementOf(outer), sign);
    const flush = vi.fn((element: FiberElement) => {
      if (element === root) expect(raw.get(root)).toContain('transition-property:none');
    });
    vi.stubGlobal('__FlushElementTree', flush);
    expect(bind(outer, 1)).toBe(sign);
    expect(elementOf(b.row)).toBe(root);
    expect(gSignMap[__GetElementUniqueID(elementOf(outer))]!.get(sign)).toBe(b.row);
    expect(flush).toHaveBeenCalled();
    // A remains a logical data-source row, even though its native inner list
    // was discarded. Measurements captured before release seed its next bind.
    expect(outer.childNodes).toContain(a.row);
    expect(snapshotInstanceManager.values.get(measuredAChild.__id)).toBe(measuredAChild);
    expect(measuredAChild.__listItemMeasuredExtent).toBe(100);
    expect(measuredAChild.__listItemMeasuredOrientation).toBe('horizontal');
    expect(frames).toHaveLength(1);
    expect(raw.get(root)).toContain('transition-property:none');
    frames.shift()!();
    expect(raw.get(root)).toBe(styleB);
    expect(b.row.__restoreReuseTransition).toBeUndefined();

    // The same logical item's enqueue/rebind bypasses the cross-owner path.
    flush.mockImplementation(() => {});
    elementTree.triggerEnqueueComponent(elementOf(outer), sign);
    expect(bind(outer, 1)).toBe(sign);
    expect(frames).toHaveLength(0);
    const api = new Element(root);
    const expansion = api.animate([{ height: '120px' }, { height: '240px' }], 300);
    api.setStyleProperty('height', '240px');
    expect(animate).toHaveBeenCalledWith(root, [0, expansion.id, [
      { height: '120px' },
      { height: '240px' },
    ], { duration: 300 }]);
    expect(properties.get(root)?.get('height')).toBe('240px');
    expect(raw.get(root)).toBe(styleB);
    expect(b.row.__restoreReuseTransition).toBeUndefined();

    elementTree.triggerEnqueueComponent(elementOf(outer), sign);
    expect(bind(outer, 0)).toBe(sign);
    expect(elementOf(a.inner).props['update-list-info'].at(-1).insertAction).toEqual([
      expect.objectContaining({ 'item-key': 'a-child', 'estimated-main-axis-size-px': 100 }),
    ]);
    expect(frames).toHaveLength(1);
    expect(raw.get(root)).toContain('transition-property:none');
    api.setStyleProperties({ height: '260px', color: 'red' });
    const writes = writeRaw.mock.calls.length;
    frames.shift()!();
    expect(writeRaw).toHaveBeenCalledTimes(writes);
    expect(properties.get(root)?.get('height')).toBe('260px');
    expect(properties.get(root)?.get('color')).toBe('red');
    expect(raw.get(root)).toBe(styleA);
    expect(a.row.__restoreReuseTransition).toBeUndefined();
  });

  it('restores a recycled row transition when a later batch index fails without scheduling its scroll completion', () => {
    const { raw, frames } = mockInlineStyles();
    const a = pendingRow('a', 10);
    const b = pendingRow('b', 20);
    a.row.__values = ['height:100px;transition:height 300ms;'];
    const target = 'height:120px;transition:height 300ms;';
    b.row.__values = [target];
    const owner = list([a.row, b.row]);
    owner.ensureElements();
    const sign = bind(owner, 0);
    const root = elementOf(a.row);
    elementTree.triggerEnqueueComponent(elementOf(owner), sign);
    invoke.mockClear();
    const [, batch] = componentAtIndexFactory(owner.childNodes, hydrate);

    expect(() => batch(elementOf(owner), __GetElementUniqueID(elementOf(owner)), [1, 99], [1, 2], false, false))
      .toThrow('childCtx not found');

    expect(gSignMap[__GetElementUniqueID(elementOf(owner))]!.get(sign)).toBe(b.row);
    expect(raw.get(root)).toBe(target);
    expect(b.row.__restoreReuseTransition).toBeUndefined();
    expect(frames).toHaveLength(0);
    expect(invoke).not.toHaveBeenCalled();
    const next = pendingRow('next', 30);
    const nextOwner = list([next.row]);
    nextOwner.ensureElements();
    bind(nextOwner);
    expect(invoke.mock.calls.map(([element]) => element)).toEqual([elementOf(next.inner)]);
  });

  it.each(['direct', 'retained clone'] as const)(
    'restores normal root and descendant transitions after a reentrant third owner binds with equal styles (%s)',
    handoff => {
      const { raw, frames } = mockInlineStyles();
      const rootStyle = 'height:120px;transition:height 300ms;';
      const childStyle = 'opacity:1;transition:opacity 200ms;';
      const items = ['a', 'b', 'c'].map((key, index) => {
        const item = pendingRow(key, 10 + index);
        const child = new SnapshotInstance('view');
        child.__values = [{ style: childStyle }];
        item.row.__values = [rootStyle];
        item.row.__insertBefore(child, item.inner);
        return { ...item, child };
      });
      const [a, b, c] = items;
      const outer = list(items.map(({ row }) => row));
      outer.ensureElements();
      const sign = bind(outer, 0);
      const root = elementOf(a!.row);
      const descendant = elementOf(a!.child);
      const listID = __GetElementUniqueID(elementOf(outer));
      elementTree.triggerEnqueueComponent(elementOf(outer), sign);
      let reentered = false;
      vi.stubGlobal('__FlushElementTree', (element: FiberElement) => {
        if (element !== root || reentered || gSignMap[listID]!.get(sign) !== b!.row) return;
        reentered = true;
        expect(raw.get(root)).toContain('transition-property:none');
        expect(raw.get(descendant)).toContain('transition-property:none');
        if (handoff === 'retained clone') {
          const newBSign = bind(outer, 1);
          const retained = gSignMap[listID]!.get(sign)!;
          expect(newBSign).not.toBe(sign);
          expect(retained).not.toBe(b!.row);
          expect(retained.__id).toBe(b!.row.__id);
          expect(snapshotInstanceManager.values.get(retained.__id)).toBe(b!.row);
          expect(retained.__restoreReuseTransition).toBeUndefined();
          expect(elementOf(retained)).toBe(root);
          expect(gSignMap[listID]!.get(newBSign)).toBe(b!.row);
        }
        elementTree.triggerEnqueueComponent(elementOf(outer), sign);
        expect(bind(outer, 2)).toBe(sign);
      });

      expect(bind(outer, 1)).toBe(sign);
      expect(reentered).toBe(true);
      expect(gSignMap[listID]!.get(sign)).toBe(c!.row);
      expect(elementOf(c!.row)).toBe(root);
      expect(elementOf(c!.child)).toBe(descendant);
      expect(frames).toHaveLength(2);
      while (frames.length) frames.shift()!();
      expect.soft(raw.get(root)).toBe(rootStyle);
      expect.soft(raw.get(descendant)).toBe(childStyle);
      expect(c!.row.__restoreReuseTransition).toBeUndefined();
    },
  );

  it('finishes reentrant synchronous binds after the surrounding native flush returns', () => {
    const a = pendingRow('a', 10);
    const b = pendingRow('b', 20);
    const outerA = list([a.row]);
    const outerB = list([b.row]);
    outerA.ensureElements();
    outerB.ensureElements();
    const log: string[] = [];
    vi.stubGlobal('__FlushElementTree', (element: FiberElement) => {
      if (element === a.row.__element_root) {
        log.push('begin:a');
        bind(outerB);
        log.push('end:a');
      } else if (element === b.row.__element_root) {
        log.push('begin:b', 'end:b');
      }
    });
    invoke.mockImplementation((element, _method, _params, done) => {
      log.push(element === elementOf(a.inner) ? 'restore:a' : 'restore:b');
      done({ code: 0 });
    });

    bind(outerA);

    expect(log).toEqual(['begin:a', 'begin:b', 'end:b', 'end:a', 'restore:b', 'restore:a']);
  });

  it('drains completion work appended by a reentrant native command', () => {
    const a = pendingRow('a', 10);
    const b = pendingRow('b', 20);
    const outerA = list([a.row]);
    const outerB = list([b.row]);
    outerA.ensureElements();
    outerB.ensureElements();
    const log: string[] = [];
    vi.stubGlobal('__FlushElementTree', (element: FiberElement) => {
      log.push(element === elementOf(outerB) ? 'flush:b-batch' : 'flush:a');
    });
    invoke.mockImplementation((element, _method, _params, done) => {
      if (element === elementOf(a.inner)) {
        log.push('restore:a');
        elementTree.triggerComponentAtIndexes(elementOf(outerB), [0], [2], false, false);
      } else {
        log.push('restore:b');
      }
      done({ code: 0 });
    });

    bind(outerA);

    expect(log).toEqual(['flush:a', 'restore:a', 'flush:b-batch', 'restore:b']);
  });

  it('suppresses transitions on cells that a kept nested list rebinds for another item', () => {
    const { raw, frames } = mockInlineStyles();
    const cellA = keyedRow('c0');
    cellA.__values = ['height:100px;transition:height 300ms;'];
    const cellB = keyedRow('c0');
    const target = 'height:120px;transition:height 300ms;';
    cellB.__values = [target];
    // The row snapshot is itself the list holder, so the recycle keeps its native list.
    const rowA = list([cellA]);
    rowA.__listItemPlatformInfo = { 'item-key': 'a' };
    const rowB = list([cellB]);
    rowB.__listItemPlatformInfo = { 'item-key': 'b' };
    const outer = list([rowA, rowB]);
    node(ROW, [outer]).ensureElements();
    const sign = bind(outer, 0);
    bind(rowA, 0);
    const listElement = elementOf(rowA);
    const cellRoot = elementOf(cellA);
    elementTree.triggerEnqueueComponent(elementOf(outer), sign);
    let atFlush: string | undefined;
    vi.stubGlobal('__FlushElementTree', (element: FiberElement) => {
      if (element === listElement) atFlush = raw.get(cellRoot);
    });

    expect(bind(outer, 1)).toBe(sign);

    expect(elementOf(rowB)).toBe(listElement);
    expect(elementOf(cellB)).toBe(cellRoot);
    expect(atFlush).toBe(`${target};transition-property:none !important;`);
    while (frames.length) frames.shift()!();
    expect(raw.get(cellRoot)).toBe(target);
  });

  it('releases kept cell suppression when the recycle hydration throws', () => {
    const { raw, frames } = mockInlineStyles();
    const cellA = keyedRow('c0');
    cellA.__values = ['height:100px;transition:height 300ms;'];
    const cellB = keyedRow('c0');
    cellB.__values = ['height:120px;transition:height 300ms;'];
    const rowA = list([cellA]);
    rowA.__listItemPlatformInfo = { 'item-key': 'a' };
    const rowB = list([cellB, keyedRow('c1')]);
    rowB.__listItemPlatformInfo = { 'item-key': 'b' };
    const outer = list([rowA, rowB]);
    node(ROW, [outer]).ensureElements();
    const sign = bind(outer, 0);
    bind(rowA, 0);
    const cellRoot = elementOf(cellA);
    elementTree.triggerEnqueueComponent(elementOf(outer), sign);
    const [componentAtIndex] = componentAtIndexFactory(outer.childNodes, (before, after, options, reuseRoot) => {
      hydrate(before, after, options, reuseRoot);
      throw new Error('hydrate failed');
    });

    expect(() => componentAtIndex(elementOf(outer), __GetElementUniqueID(elementOf(outer)), 1, 0, false))
      .toThrow('hydrate failed');
    while (frames.length) frames.shift()!();

    expect(raw.get(cellRoot)).not.toContain('transition-property:none');
    expect(cellB.__restoreReuseTransition).toBeUndefined();
  });

  it('does not suppress transitions when a nested list recycles its own cells', () => {
    const { writeRaw, frames } = mockInlineStyles();
    const c0 = keyedRow('c0');
    c0.__values = ['height:100px;transition:height 300ms;'];
    const c1 = keyedRow('c1');
    c1.__values = ['height:120px;transition:height 300ms;'];
    const inner = list([c0, c1]);
    const outer = list([keyedRow('a', [inner])]);
    node(ROW, [outer]).ensureElements();
    bind(outer, 0);
    const sign = bind(inner, 0);
    const cellRoot = elementOf(c0);
    elementTree.triggerEnqueueComponent(elementOf(inner), sign);
    writeRaw.mockClear();

    expect(bind(inner, 1)).toBe(sign);

    expect(frames).toHaveLength(0);
    expect(
      writeRaw.mock.calls.some(([element, value]) =>
        element === cellRoot && String(value).includes('transition-property:none')
      ),
    ).toBe(false);
  });

  it('restores a saved zero offset because a new list may not start at zero', () => {
    const inner = list([keyedRow('c0')]);
    inner.__listScrollOffset = { x: 0, y: 0 };
    const outer = list([keyedRow('a', [inner])]);
    node(ROW, [outer]).ensureElements();

    bind(outer, 0);

    expect(invoke).toHaveBeenCalledExactlyOnceWith(
      elementOf(inner),
      'scrollToPosition',
      expect.objectContaining({ position: 0 }),
      expect.any(Function),
    );
  });

  it('suppresses transitions on cells a kept nested list recycles while its row rebinds', () => {
    const { raw, frames } = mockInlineStyles();
    const a0 = keyedRow('a0');
    a0.__values = ['height:100px;transition:height 300ms;'];
    const b0 = keyedRow('b0');
    const target = 'height:120px;transition:height 300ms;';
    b0.__values = [target];
    const rowA = list([a0]);
    rowA.__listItemPlatformInfo = { 'item-key': 'a' };
    const rowB = list([b0]);
    rowB.__listItemPlatformInfo = { 'item-key': 'b' };
    const outer = list([rowA, rowB]);
    node(ROW, [outer]).ensureElements();
    const sign = bind(outer, 0);
    const cellSign = bind(rowA, 0);
    const listElement = elementOf(rowA);
    const cellRoot = elementOf(a0);
    elementTree.triggerEnqueueComponent(elementOf(outer), sign);
    let relaid = false;
    let atCellFlush: string | undefined;
    vi.stubGlobal('__FlushElementTree', (element: FiberElement) => {
      if (element === listElement && !relaid) {
        relaid = true;
        // Native lays out the kept list inside the row's flush and reuses a0's cell for b0.
        elementTree.triggerEnqueueComponent(listElement as TestElement, cellSign);
        expect(bind(rowB, 0)).toBe(cellSign);
      } else if (element === cellRoot) {
        atCellFlush = raw.get(cellRoot);
      }
    });

    expect(bind(outer, 1)).toBe(sign);

    expect(relaid).toBe(true);
    expect(atCellFlush).toBe(`${target};transition-property:none !important;`);
    while (frames.length) frames.shift()!();
    expect(raw.get(cellRoot)).toBe(target);
  });

  it('keeps a newer kept list marked when a cleared rebind restores its transitions late', () => {
    const { raw, frames } = mockInlineStyles();
    const rowRebind = (prefix: string) => {
      const a0 = keyedRow(`${prefix}a0`);
      a0.__values = ['height:100px;transition:height 300ms;'];
      const b0 = keyedRow(`${prefix}b0`);
      const target = 'height:120px;transition:height 300ms;';
      b0.__values = [target];
      const rowA = list([a0]);
      rowA.__listItemPlatformInfo = { 'item-key': `${prefix}a` };
      const rowB = list([b0]);
      rowB.__listItemPlatformInfo = { 'item-key': `${prefix}b` };
      const outer = list([rowA, rowB]);
      node(ROW, [outer]).ensureElements();
      const outerElement = elementOf(outer);
      const sign = bind(outer, 0);
      const cellSign = bind(rowA, 0);
      const listElement = elementOf(rowA);
      const cellRoot = elementOf(a0);
      elementTree.triggerEnqueueComponent(outerElement, sign);
      vi.stubGlobal('__FlushElementTree', () => {});
      // Async flush: the kept list binds its cell for the new item after the row's bind.
      elementTree.triggerComponentAtIndexes(outerElement, [1], [7], false, true);
      return { rowB, listElement, cellSign, cellRoot, target };
    };
    rowRebind('stale-');
    const staleFrames = frames.splice(0);
    clearListGlobal();
    const current = rowRebind('current-');
    // The cleared rebind's frame fires after the newer row marked its kept list.
    for (const frame of staleFrames) frame();
    const seen: string[] = [];
    vi.stubGlobal('__FlushElementTree', (element: FiberElement) => {
      if (element === current.cellRoot) seen.push(String(raw.get(current.cellRoot)));
    });
    elementTree.triggerEnqueueComponent(current.listElement as TestElement, current.cellSign);

    expect(bind(current.rowB, 0)).toBe(current.cellSign);

    expect(seen[0]).toBe(`${current.target};transition-property:none !important;`);
  });

  it.each(['batch', 'asyncFlush'] as const)(
    'suppresses cells a kept nested list binds for the new item after a %s row rebind',
    mode => {
      const { raw, frames } = mockInlineStyles();
      const a0 = keyedRow('a0');
      a0.__values = ['height:100px;transition:height 300ms;'];
      const b0 = keyedRow('b0');
      const target = 'height:120px;transition:height 300ms;';
      b0.__values = [target];
      const b1 = keyedRow('b1');
      b1.__values = ['height:90px;transition:height 300ms;'];
      const rowA = list([a0]);
      rowA.__listItemPlatformInfo = { 'item-key': 'a' };
      const rowB = list([b0, b1]);
      rowB.__listItemPlatformInfo = { 'item-key': 'b' };
      const outer = list([rowA, rowB]);
      node(ROW, [outer]).ensureElements();
      const outerElement = elementOf(outer);
      const sign = bind(outer, 0);
      const cellSign = bind(rowA, 0);
      const listElement = elementOf(rowA);
      const cellRoot = elementOf(a0);
      elementTree.triggerEnqueueComponent(outerElement, sign);
      const seen: string[] = [];
      const bindInner = () => {
        elementTree.triggerEnqueueComponent(listElement as TestElement, cellSign);
        expect(bind(rowB, 0)).toBe(cellSign);
      };
      vi.stubGlobal('__FlushElementTree', (element: FiberElement, options?: { operationIDs?: number[] }) => {
        if (mode === 'batch' && element === outerElement && options?.operationIDs) bindInner();
        else if (element === cellRoot) seen.push(String(raw.get(cellRoot)));
      });

      elementTree.triggerComponentAtIndexes(outerElement, [1], [7], false, mode === 'asyncFlush');
      if (mode === 'asyncFlush') bindInner();

      expect(seen[0]).toBe(`${target};transition-property:none !important;`);
      while (frames.length) frames.shift()!();
      expect(raw.get(cellRoot)).toBe(target);
      // After the row's frame, the list's own scroll recycles keep their transitions.
      elementTree.triggerEnqueueComponent(listElement as TestElement, cellSign);
      seen.length = 0;
      expect(bind(rowB, 1)).toBe(cellSign);
      expect(seen[0]).not.toContain('transition-property:none');
    },
  );

  it('releases a nested list that a recycled row drops for an item without one', () => {
    const inner = list([keyedRow('c0')]);
    const b = keyedRow('b');
    const outer = list([keyedRow('a', [inner]), b]);
    node(ROW, [outer]).ensureElements();
    const sign = bind(outer, 0);
    const innerElement = elementOf(inner);
    const innerID = __GetElementUniqueID(innerElement);
    elementTree.triggerEnqueueComponent(elementOf(outer), sign);

    expect(bind(outer, 1)).toBe(sign);

    expect(parentMap.has(innerElement as TestElement)).toBe(false);
    expect(gSignMap[innerID]).toBeUndefined();
    expect(gRecycleMap[innerID]).toBeUndefined();
  });

  it.each(['missing', 'throwing'] as const)(
    'restores a recycled row transition when the frame API is %s',
    kind => {
      const { raw, frames } = mockInlineStyles();
      vi.stubGlobal('lynx', {
        ...lynx,
        requestAnimationFrame: kind === 'missing' ? undefined : () => {
          throw new Error('requestAnimationFrame in main thread script requires Lynx sdk version 2.16');
        },
      });
      const a = pendingRow('a', 10);
      const b = pendingRow('b', 20);
      a.row.__values = ['height:100px;transition:height 300ms;'];
      const target = 'height:120px;transition:height 300ms;';
      b.row.__values = [target];
      const owner = list([a.row, b.row]);
      owner.ensureElements();
      const sign = bind(owner, 0);
      const root = elementOf(a.row);
      elementTree.triggerEnqueueComponent(elementOf(owner), sign);

      expect(bind(owner, 1)).toBe(sign);

      expect(frames).toHaveLength(0);
      expect(raw.get(root)).toBe(target);
    },
  );

  it('releases a recycled ready row even when its deferred batch sibling never becomes ready', async () => {
    const { raw, frames } = mockInlineStyles();
    const a = pendingRow('a', 10);
    const b = pendingRow('b', 20);
    const deferred = pendingRow('deferred', 30);
    deferred.row.setAttribute('isReady', 0);
    const rowStyle = 'height:120px;transition:height 300ms;';
    a.row.__values = ['height:100px;transition:height 300ms;'];
    b.row.__values = [rowStyle];
    const owner = list([a.row, b.row, deferred.row]);
    owner.ensureElements();
    __SetAttribute(elementOf(owner), 'custom-list-name', 'list-container');
    const sign = bind(owner, 0);
    const root = elementOf(a.row);
    elementTree.triggerEnqueueComponent(elementOf(owner), sign);
    invoke.mockClear();
    vi.stubGlobal('__FlushElementTree', vi.fn());

    componentAtIndexFactory(owner.childNodes, hydrate)[1](
      elementOf(owner),
      __GetElementUniqueID(elementOf(owner)),
      [1, 2],
      [1, 2],
      false,
      false,
    );
    await Promise.resolve();
    while (frames.length) frames.shift()!();

    expect(gSignMap[__GetElementUniqueID(elementOf(owner))]!.get(sign)).toBe(b.row);
    expect(raw.get(root)).toBe(rowStyle);
    expect(invoke.mock.calls.map(([element]) => element)).toEqual([elementOf(b.inner)]);
  });

  it('completes ready cells after the first flush and deferred cells after their own batch', async () => {
    const a = pendingRow('a', 10);
    const deferredA = pendingRow('deferred-a', 11);
    const b = pendingRow('b', 20);
    const deferredB = pendingRow('deferred-b', 21);
    for (const item of [deferredA.row, deferredB.row]) item.setAttribute('isReady', 0);
    const outerA = list([a.row, deferredA.row]);
    const outerB = list([b.row, deferredB.row]);
    for (const owner of [outerA, outerB]) {
      owner.ensureElements();
      __SetAttribute(elementOf(owner), 'custom-list-name', 'list-container');
    }
    const [singleA, batchA] = componentAtIndexFactory(outerA.childNodes, hydrate);
    const [, batchB] = componentAtIndexFactory(outerB.childNodes, hydrate);
    const flush = vi.fn();
    vi.stubGlobal('__FlushElementTree', flush);
    batchA(elementOf(outerA), __GetElementUniqueID(elementOf(outerA)), [0, 1], [11, 12], false, false);
    batchB(elementOf(outerB), __GetElementUniqueID(elementOf(outerB)), [0, 1], [21, 22], false, false);
    expect(() => singleA(elementOf(outerA), __GetElementUniqueID(elementOf(outerA)), 1, 0, false))
      .toThrow('componentAtIndex was called on a pending deferred list item');
    // A ready cell is committed by its batch's first flush and does not wait for a deferred sibling.
    expect(invoke.mock.calls.map(([element]) => element)).toEqual([elementOf(a.inner), elementOf(b.inner)]);

    const readyA = deferredA.row.__extraProps!['isReady'] as Promise<number>;
    deferredA.row.setAttribute('isReady', 1);
    await readyA;
    await Promise.resolve();
    expect(invoke.mock.calls.map(([element]) => element)).toEqual([
      elementOf(a.inner),
      elementOf(b.inner),
      elementOf(deferredA.inner),
    ]);
    expect(flush).toHaveBeenCalledWith(
      elementOf(outerA),
      expect.objectContaining({
        operationIDs: [11, 12],
        elementIDs: [__GetElementUniqueID(elementOf(a.row)), __GetElementUniqueID(elementOf(deferredA.row))],
      }),
    );

    const readyB = deferredB.row.__extraProps!['isReady'] as Promise<number>;
    deferredB.row.setAttribute('isReady', 1);
    await readyB;
    await Promise.resolve();
    expect(invoke.mock.calls.map(([element]) => element)).toEqual([
      elementOf(a.inner),
      elementOf(b.inner),
      elementOf(deferredA.inner),
      elementOf(deferredB.inner),
    ]);
    expect(flush).toHaveBeenLastCalledWith(elementOf(outerB), expect.objectContaining({ operationIDs: [21, 22] }));
  });

  it('restores the remaining recycled rows when an earlier completion throws', () => {
    const { raw, frames } = mockInlineStyles();
    const rows = ['a', 'c', 'b', 'd'].map((key, index) => pendingRow(key, 10 + index));
    const targets = ['height:120px;transition:height 300ms;', 'height:140px;transition:height 300ms;'];
    rows[0]!.row.__values = ['height:100px;transition:height 300ms;'];
    rows[1]!.row.__values = ['height:110px;transition:height 300ms;'];
    rows[2]!.row.__values = [targets[0]];
    rows[3]!.row.__values = [targets[1]];
    const owner = list(rows.map(({ row }) => row));
    owner.ensureElements();
    const listID = __GetElementUniqueID(elementOf(owner));
    const signs = [bind(owner, 0), bind(owner, 1)];
    const roots = [elementOf(rows[0]!.row), elementOf(rows[1]!.row)];
    for (const sign of signs) elementTree.triggerEnqueueComponent(elementOf(owner), sign);
    invoke.mockReset();
    invoke.mockImplementationOnce(() => {
      throw new Error('restore failed');
    });
    vi.stubGlobal('__FlushElementTree', vi.fn());

    expect(() =>
      componentAtIndexFactory(owner.childNodes, hydrate)[1](elementOf(owner), listID, [2, 3], [1, 2], false, false)
    )
      .toThrow('restore failed');

    // The failing row's restore was queued before its scroll restore threw; the next row is released now.
    expect(frames).toHaveLength(1);
    expect(raw.get(roots[1]!)).toBe(targets[1]);
    expect(rows[3]!.row.__restoreReuseTransition).toBeUndefined();
    frames.shift()!();
    expect(raw.get(roots[0]!)).toBe(targets[0]);
  });

  it('releases a deferred sibling after another deferred cell in its batch fails to bind', async () => {
    const errors: unknown[] = [];
    const onRejection = (error: unknown) => errors.push(error);
    process.on('unhandledRejection', onRejection);
    const { raw, frames } = mockInlineStyles();
    const a = pendingRow('a', 10);
    const b = pendingRow('b', 20);
    const failing = keyedRow('failing');
    const rowStyle = 'height:120px;transition:height 300ms;';
    a.row.__values = ['height:100px;transition:height 300ms;'];
    b.row.__values = [rowStyle];
    for (const row of [b.row, failing]) row.setAttribute('isReady', 0);
    const owner = list([a.row, b.row, failing]);
    owner.ensureElements();
    __SetAttribute(elementOf(owner), 'custom-list-name', 'list-container');
    const listID = __GetElementUniqueID(elementOf(owner));
    const sign = bind(owner, 0);
    const root = elementOf(a.row);
    elementTree.triggerEnqueueComponent(elementOf(owner), sign);
    const flush = vi.fn();
    vi.stubGlobal('__FlushElementTree', flush);
    try {
      componentAtIndexFactory(owner.childNodes, hydrate)[1](elementOf(owner), listID, [1, 2], [1, 2], false, false);
      flush.mockClear();
      // B binds into A's row and waits for the batch's final flush.
      const readyB = b.row.__extraProps!['isReady'] as Promise<number>;
      b.row.setAttribute('isReady', 1);
      await readyB;
      expect(raw.get(root)).not.toBe(rowStyle);

      vi.spyOn(failing, 'ensureElements').mockImplementation(() => {
        throw new Error('deferred bind failed');
      });
      failing.setAttribute('isReady', 1);
      for (let i = 0; i < 5; i++) await new Promise(resolve => setTimeout(resolve, 0));
    } finally {
      process.off('unhandledRejection', onRejection);
    }

    expect(errors).toEqual([new Error('deferred bind failed')]);
    // The batch's final list flush is skipped, as before, but B's rebind work is released.
    expect(flush.mock.calls.filter(([target]) => target === elementOf(owner))).toEqual([]);
    expect(raw.get(root)).toBe(rowStyle);
    expect(b.row.__restoreReuseTransition).toBeUndefined();
    expect(frames).toHaveLength(0);
  });

  it('releases deferred siblings that bind after another deferred cell in their batch failed', async () => {
    const errors: unknown[] = [];
    const onRejection = (error: unknown) => errors.push(error);
    process.on('unhandledRejection', onRejection);
    const { raw, frames } = mockInlineStyles();
    const a = pendingRow('a', 10);
    const b = pendingRow('b', 20);
    const failing = [keyedRow('failing-1'), keyedRow('failing-2')];
    const rowStyle = 'height:120px;transition:height 300ms;';
    a.row.__values = ['height:100px;transition:height 300ms;'];
    b.row.__values = [rowStyle];
    for (const row of [b.row, ...failing]) row.setAttribute('isReady', 0);
    // Failing cells are created fresh, leaving A's row for B.
    for (const row of failing) row.__listItemPlatformInfo!['reuse-identifier'] = 'fresh';
    const owner = list([a.row, failing[0]!, b.row, failing[1]!]);
    owner.ensureElements();
    __SetAttribute(elementOf(owner), 'custom-list-name', 'list-container');
    const listID = __GetElementUniqueID(elementOf(owner));
    const sign = bind(owner, 0);
    const root = elementOf(a.row);
    elementTree.triggerEnqueueComponent(elementOf(owner), sign);
    const flush = vi.fn();
    vi.stubGlobal('__FlushElementTree', flush);
    const wait = async () => {
      for (let i = 0; i < 5; i++) await new Promise(resolve => setTimeout(resolve, 0));
    };
    try {
      componentAtIndexFactory(owner.childNodes, hydrate)[1](
        elementOf(owner),
        listID,
        [1, 2, 3],
        [1, 2, 3],
        false,
        false,
      );
      flush.mockClear();
      failing.forEach((row, index) => {
        vi.spyOn(row, 'ensureElements').mockImplementation(() => {
          throw new Error(`deferred bind ${index + 1} failed`);
        });
      });
      failing[0]!.setAttribute('isReady', 1);
      await wait();
      // B binds into A's row after the batch already failed.
      b.row.setAttribute('isReady', 1);
      await wait();
      expect(gSignMap[listID]!.get(sign)).toBe(b.row);
      expect(raw.get(root)).toBe(rowStyle);
      expect(b.row.__restoreReuseTransition).toBeUndefined();
      failing[1]!.setAttribute('isReady', 1);
      await wait();
    } finally {
      process.off('unhandledRejection', onRejection);
    }

    expect(errors).toEqual([new Error('deferred bind 1 failed'), new Error('deferred bind 2 failed')]);
    expect(flush.mock.calls.filter(([target]) => target === elementOf(owner))).toEqual([]);
    expect(frames).toHaveLength(0);
  });

  it('releases deferred cells when their batch final flush throws', async () => {
    const errors: unknown[] = [];
    const onRejection = (error: unknown) => errors.push(error);
    process.on('unhandledRejection', onRejection);
    const { raw, frames } = mockInlineStyles();
    const a = pendingRow('a', 10);
    const b = pendingRow('b', 20);
    const rowStyle = 'height:120px;transition:height 300ms;';
    a.row.__values = ['height:100px;transition:height 300ms;'];
    b.row.__values = [rowStyle];
    b.row.setAttribute('isReady', 0);
    const owner = list([a.row, b.row]);
    owner.ensureElements();
    __SetAttribute(elementOf(owner), 'custom-list-name', 'list-container');
    const listID = __GetElementUniqueID(elementOf(owner));
    const sign = bind(owner, 0);
    const root = elementOf(a.row);
    elementTree.triggerEnqueueComponent(elementOf(owner), sign);
    vi.stubGlobal('__FlushElementTree', vi.fn());
    try {
      componentAtIndexFactory(owner.childNodes, hydrate)[1](elementOf(owner), listID, [1], [1], false, false);
      vi.stubGlobal('__FlushElementTree', (target: FiberElement) => {
        if (target === elementOf(owner)) throw new Error('final flush failed');
      });
      b.row.setAttribute('isReady', 1);
      for (let i = 0; i < 5; i++) await new Promise(resolve => setTimeout(resolve, 0));
    } finally {
      process.off('unhandledRejection', onRejection);
    }

    expect(errors).toEqual([new Error('final flush failed')]);
    expect(gSignMap[listID]!.get(sign)).toBe(b.row);
    expect(raw.get(root)).toBe(rowStyle);
    expect(b.row.__restoreReuseTransition).toBeUndefined();
    expect(frames).toHaveLength(0);
    expect(invoke).not.toHaveBeenCalledWith(
      elementOf(b.inner),
      expect.anything(),
      expect.anything(),
      expect.anything(),
    );
  });

  it('reports a failed deferred bind outside a batch once', async () => {
    const errors: unknown[] = [];
    const onRejection = (error: unknown) => errors.push(error);
    process.on('unhandledRejection', onRejection);
    const failing = keyedRow('failing');
    failing.setAttribute('isReady', 0);
    const owner = list([failing]);
    owner.ensureElements();
    __SetAttribute(elementOf(owner), 'custom-list-name', 'list-container');
    try {
      expect(bind(owner, 0) as unknown).toBeInstanceOf(Promise);
      vi.spyOn(failing, 'ensureElements').mockImplementation(() => {
        throw new Error('deferred bind failed');
      });
      failing.setAttribute('isReady', 1);
      for (let i = 0; i < 5; i++) await new Promise(resolve => setTimeout(resolve, 0));
    } finally {
      process.off('unhandledRejection', onRejection);
    }
    expect(errors).toEqual([new Error('deferred bind failed')]);
  });

  it('does not leak a failed batch completion into the next synchronous commit', () => {
    const failed = pendingRow('failed', 10);
    const next = pendingRow('next', 20);
    const outer = list([failed.row]);
    const nextOuter = list([next.row]);
    outer.ensureElements();
    nextOuter.ensureElements();
    const [, batch] = componentAtIndexFactory(outer.childNodes, hydrate);
    expect(() => batch(elementOf(outer), __GetElementUniqueID(elementOf(outer)), [0, 1], [1, 2], false, false))
      .toThrow('childCtx not found');
    expect(invoke).not.toHaveBeenCalled();

    bind(nextOuter);

    expect(invoke.mock.calls.map(([element]) => element)).toEqual([elementOf(next.inner)]);
  });

  it('clears the synchronous completion scope when a reentrant native flush fails', () => {
    const failed = pendingRow('failed', 10);
    const reentrant = pendingRow('reentrant', 11);
    const next = pendingRow('next', 20);
    const outer = list([failed.row, reentrant.row]);
    const nextOuter = list([next.row]);
    outer.ensureElements();
    nextOuter.ensureElements();
    vi.stubGlobal('__FlushElementTree', (element: FiberElement) => {
      if (element === failed.row.__element_root) {
        bind(outer, 1);
        throw new Error('native flush failed');
      }
    });

    expect(() => bind(outer)).toThrow('native flush failed');
    expect(invoke).not.toHaveBeenCalled();
    bind(nextOuter);
    expect(invoke.mock.calls.map(([element]) => element)).toEqual([elementOf(next.inner)]);
  });
});

describe('non-recyclable native enqueue ordering', () => {
  it('evicts only a removed logical key before later holder stages read and clear their delegate', () => {
    const removed = pendingRow('removed', 10);
    const current = pendingRow('current', 20);
    for (const { row } of [removed, current]) row.__listItemPlatformInfo!.recyclable = false;
    const outer = list([removed.row, current.row]);
    outer.ensureElements();
    const removedSign = bind(outer, 0);
    const currentSign = bind(outer, 1);
    const removedRoot = elementOf(removed.row);
    const currentRoot = elementOf(current.row);
    const removedInnerID = __GetElementUniqueID(elementOf(removed.inner));
    const currentInnerID = __GetElementUniqueID(elementOf(current.inner));
    const nativeList = elementOf(outer);
    const listID = __GetElementUniqueID(nativeList);
    outer.removeChild(removed.row);
    __pendingListUpdates.flush();
    const remove = vi.spyOn(globalThis, '__RemoveElement');
    const stages: string[] = [];

    function enqueue(key: string, sign: number, root: TestElement): void {
      // Native UI detachment and its delegate are distinct from the Element
      // PAPI tree. This models their audited order, not native memory safety.
      const holder: { painting: boolean; attached: boolean; delegate: { element: TestElement } | undefined } = {
        painting: true,
        attached: true,
        delegate: { element: root },
      };
      stages.push(`${key}:RemovePaintingNode`);
      holder.painting = false;
      stages.push(`${key}:SDKenqueue`);
      elementTree.triggerEnqueueComponent(nativeList, sign);
      stages.push(`${key}:DetachChild`);
      holder.attached = false;
      stages.push(`${key}:disappear`);
      expect(holder.delegate?.element).toBe(root);
      expect(holder.delegate?.element.type).toBe('list-item');
      expect(holder.painting).toBe(false);
      expect(holder.attached).toBe(false);
      stages.push(`${key}:delegate-clear`);
      holder.delegate = undefined;
      expect(holder.delegate).toBeUndefined();
    }

    enqueue('current', currentSign, currentRoot);
    expect(current.row.__element_root).toBe(currentRoot);
    expect(parentMap.get(currentRoot)).toBe(nativeList);
    expect(gSignMap[listID]!.get(currentSign)).toBe(current.row);
    expect(gRecycleMap[listID]!.get(ROW)!.get(currentSign)).toBe(current.row);
    expect(gSignMap[currentInnerID]).toBeDefined();
    expect(remove).not.toHaveBeenCalled();

    enqueue('removed', removedSign, removedRoot);
    expect(remove).toHaveBeenCalledExactlyOnceWith(nativeList, removedRoot);
    expect(nativeList.children).toEqual([currentRoot]);
    expect(parentMap.has(removedRoot)).toBe(false);
    expect(removed.row.__elements).toBeUndefined();
    expect(removed.row.__element_root).toBeUndefined();
    expect(removed.inner.__elements).toBeUndefined();
    expect(gSignMap[listID]!.has(removedSign)).toBe(false);
    expect([...gRecycleMap[listID]!.values()].some(pool => pool.has(removedSign))).toBe(false);
    expect(gSignMap[removedInnerID]).toBeUndefined();
    expect(gRecycleMap[removedInnerID]).toBeUndefined();
    expect(gSignMap[currentInnerID]).toBeDefined();
    expect(stages).toEqual(['current', 'removed'].flatMap(key => [
      `${key}:RemovePaintingNode`,
      `${key}:SDKenqueue`,
      `${key}:DetachChild`,
      `${key}:disappear`,
      `${key}:delegate-clear`,
    ]));
  });
});

describe('nested list replacement boundaries', () => {
  it('drops a deferred cell that finishes after its nested list was replaced', async () => {
    const errors: unknown[] = [];
    const onRejection = (error: unknown) => errors.push(error);
    process.on('unhandledRejection', onRejection);
    try {
      const deferred = keyedRow('d0');
      deferred.setAttribute('isReady', 0);
      const innerA = list([deferred]);
      const a = keyedRow('a', [innerA]);
      const b = pendingRow('b', 20);
      const outer = list([a, b.row]);
      node(ROW, [outer]).ensureElements();
      const signA = bind(outer, 0);
      __SetAttribute(elementOf(innerA), 'custom-list-name', 'list-container');
      expect(bind(innerA, 0) as unknown).toBeInstanceOf(Promise);
      const oldInnerID = __GetElementUniqueID(elementOf(innerA));
      elementTree.triggerEnqueueComponent(elementOf(outer), signA);
      expect(bind(outer, 1)).toBe(signA);
      expect(gSignMap[oldInnerID]).toBeUndefined();

      deferred.setAttribute('isReady', 1);
      for (let i = 0; i < 5; i++) await new Promise(resolve => setTimeout(resolve, 0));
    } finally {
      process.off('unhandledRejection', onRejection);
    }
    expect(errors).toEqual([]);
  });

  it('keeps a queued restore when a reload hands the nested list to a new snapshot', async () => {
    const a = pendingRow('a', 0);
    const d1 = pendingRow('d1', 40);
    const d2 = pendingRow('d2', 0);
    for (const row of [d1.row, d2.row]) row.setAttribute('isReady', 0);
    const outer = list([a.row, d1.row, d2.row]);
    const root = node(ROW, [outer]);
    root.ensureElements();
    __SetAttribute(elementOf(outer), 'custom-list-name', 'list-container');
    const listID = __GetElementUniqueID(elementOf(outer));
    elementTree.triggerEnqueueComponent(elementOf(outer), bind(outer, 0));
    vi.stubGlobal('__FlushElementTree', vi.fn());
    componentAtIndexFactory(outer.childNodes, hydrate)[1](elementOf(outer), listID, [1, 2], [1, 2], false, false);
    // D1 reuses A's row; its restore waits for the batch's final flush, which waits for D2.
    const readyD1 = d1.row.__extraProps!['isReady'] as Promise<number>;
    d1.row.setAttribute('isReady', 1);
    await readyD1;
    const element = elementOf(d1.inner);
    expect(invoke.mock.calls.filter(([target]) => target === element)).toHaveLength(0);

    const reloadedInner = list();
    hydrate(
      root,
      node(ROW, [list([keyedRow('a', [list()]), keyedRow('d1', [reloadedInner]), keyedRow('d2', [list()])])]),
      { skipUnRef: true },
    );
    __pendingListUpdates.flush();
    expect(elementOf(reloadedInner)).toBe(element);

    d2.row.setAttribute('isReady', 1);
    for (let i = 0; i < 5; i++) await new Promise(resolve => setTimeout(resolve, 0));

    expect(invoke.mock.calls.filter(([target]) => target === element)).toHaveLength(1);
    nestedListBridge().dispatch!(
      { listID: __GetElementUniqueID(element), eventType: 'bindEvent', eventName: 'scroll', _wkltId: '' },
      [{ detail: { eventSource: 2, scrollLeft: 77 } }],
      undefined,
      () => {},
    );
    expect(reloadedInner.__listScrollOffset).toEqual({ x: 77, y: 0 });
  });

  it('settles a deferred batch without flushing its destroyed nested list', async () => {
    const deferred = keyedRow('d0');
    deferred.setAttribute('isReady', 0);
    const innerA = list([keyedRow('c0'), deferred]);
    const b = pendingRow('b', 20);
    const outer = list([keyedRow('a', [innerA]), b.row]);
    node(ROW, [outer]).ensureElements();
    const signA = bind(outer, 0);
    const innerElement = elementOf(innerA);
    __SetAttribute(innerElement, 'custom-list-name', 'list-container');
    const innerID = __GetElementUniqueID(innerElement);
    const flush = vi.fn();
    vi.stubGlobal('__FlushElementTree', flush);
    componentAtIndexFactory(innerA.childNodes, hydrate)[1](innerElement, innerID, [0, 1], [0, 1], false, false);
    elementTree.triggerEnqueueComponent(elementOf(outer), signA);
    expect(bind(outer, 1)).toBe(signA);
    expect(gSignMap[innerID]).toBeUndefined();
    flush.mockClear();

    deferred.setAttribute('isReady', 1);
    for (let i = 0; i < 5; i++) await new Promise(resolve => setTimeout(resolve, 0));

    expect(flush.mock.calls.filter(([target]) => target === innerElement)).toEqual([]);
  });

  it('keeps a reused row native list for a new snapshot of the same key when the reuse identifier is the item key', () => {
    const { raw, properties } = mockInlineStyles();
    const style = 'height:100px;transition:height 300ms;';
    // Another tracked nested list on the page.
    const tracked = list([keyedRow('t0')]);
    const trackedOuter = list([keyedRow('t', [tracked])]);
    node(ROW, [trackedOuter]).ensureElements();
    bind(trackedOuter, 0);
    const innerA = list([keyedRow('a0'), keyedRow('a1')]);
    const innerAgain = list([keyedRow('a0'), keyedRow('a1')]);
    const a = keyedRow('a', [innerA]);
    // The item was removed and added back: a new snapshot with the same key.
    const again = keyedRow('a', [innerAgain]);
    for (const row of [a, again]) {
      row.__values = [style];
      row.__listItemPlatformInfo!['reuse-identifier'] = 'a';
    }
    const outer = list([a, again]);
    node(ROW, [outer]).ensureElements();
    const sign = bind(outer, 0);
    bind(innerA, 0);
    const innerElement = elementOf(innerA);
    const cellRoot = elementOf(innerA.childNodes[0]!);
    innerA.__listScrollOffset = { x: 120, y: 0 };
    elementTree.triggerEnqueueComponent(elementOf(outer), sign);
    invoke.mockClear();

    expect(bind(outer, 1)).toBe(sign);

    // The untracked native list keeps its cells and its own scroll position.
    expect(elementOf(innerAgain)).toBe(innerElement);
    expect(invoke).not.toHaveBeenCalled();
    // No transition suppression on the row or on its kept list's cells.
    expect(raw.get(elementOf(again))).toBe(style);
    expect(elementOf(innerAgain.childNodes[0]!)).toBe(cellRoot);
    expect(properties.get(cellRoot)?.get(110)).toBeUndefined();
  });

  it('does not track nested lists in rows whose reuse identifier is their item key', () => {
    const own = pendingRow('own', 40);
    own.row.__listItemPlatformInfo!['reuse-identifier'] = 'own';
    const sharedInner = list();
    const outer = list([own.row, keyedRow('shared', [sharedInner])]);
    node(ROW, [outer]).ensureElements();
    bind(outer, 0);
    bind(outer, 1);

    // Such a row is only recycled for its own item, so its list keeps its native behavior.
    expect(__GetAttributeByName(elementOf(own.inner), 'needs-visible-cells')).toBeUndefined();
    expect(__GetAttributeByName(elementOf(sharedInner), 'needs-visible-cells')).toBe(true);
    expect(invoke).not.toHaveBeenCalled();
    emit(own.inner, 'x', 90);
    expect(own.inner.__listScrollOffset).toEqual({ x: 40, y: 0 });
  });

  it('tracks a nested list whose own-key cell sits in a list that another item can take over', () => {
    const leafA = list();
    const middle = list([keyedRow('c0', [leafA])]);
    middle.childNodes[0]!.__listItemPlatformInfo!['reuse-identifier'] = 'c0';
    // The outer rows share a pool, so the middle list can move to another item.
    const outer = list([keyedRow('a', [middle])]);
    node(ROW, [outer]).ensureElements();
    bind(outer, 0);
    bind(middle, 0);

    expect(__GetAttributeByName(elementOf(leafA), 'needs-visible-cells')).toBe(true);
  });

  it('does not track a nested list when every containing cell is reused only for its own item', () => {
    const leafA = list();
    const middle = list([keyedRow('c0', [leafA])]);
    const outer = list([keyedRow('a', [middle])]);
    for (const cell of [middle.childNodes[0]!, outer.childNodes[0]!]) {
      cell.__listItemPlatformInfo!['reuse-identifier'] = cell.__listItemPlatformInfo!['item-key'];
    }
    node(ROW, [outer]).ensureElements();
    bind(outer, 0);
    bind(middle, 0);

    expect(__GetAttributeByName(elementOf(middle), 'needs-visible-cells')).toBeUndefined();
    expect(__GetAttributeByName(elementOf(leafA), 'needs-visible-cells')).toBeUndefined();
  });

  it('treats a same-key own-identifier cell as another item when its list can change owner', () => {
    const { raw } = mockInlineStyles();
    const style = 'height:100px;transition:height 300ms;';
    const cells = [keyedRow('c0', [list()]), keyedRow('c0', [list()])];
    for (const cell of cells) {
      cell.__values = [style];
      cell.__listItemPlatformInfo!['reuse-identifier'] = 'c0';
    }
    const middle = list(cells);
    // The middle list's row shares a pool with other items' rows.
    const outer = list([keyedRow('a', [middle])]);
    node(ROW, [outer]).ensureElements();
    bind(outer, 0);
    const sign = bind(middle, 0);
    const root = elementOf(cells[0]!);
    elementTree.triggerEnqueueComponent(elementOf(middle), sign);
    let atFlush: string | undefined;
    vi.stubGlobal('__FlushElementTree', (element: FiberElement) => {
      if (element === root) atFlush = raw.get(root);
    });

    expect(bind(middle, 1)).toBe(sign);

    expect(atFlush).toBe(`${style};transition-property:none !important;`);
  });

  it('does not track the nested list of an own-identifier cell that is itself the list holder', () => {
    const addEvent = vi.fn();
    vi.stubGlobal('__AddEvent', addEvent);
    const inline = list([keyedRow('i0')]);
    inline.__listItemPlatformInfo = { 'item-key': 'inline', 'reuse-identifier': 'inline' };
    const outer = list([inline]);
    node(ROW, [outer]).ensureElements();
    bind(outer, 0);

    expect(__GetAttributeByName(elementOf(inline), 'needs-visible-cells')).toBeUndefined();
    expect(addEvent.mock.calls.filter(([element]) => element === elementOf(inline))).toEqual([]);
  });

  it('keeps the native nested list when neither item has a position', () => {
    const innerA = list([keyedRow('a0')]);
    const innerB = list([keyedRow('b0')]);
    const outer = list([keyedRow('a', [innerA]), keyedRow('b', [innerB])]);
    node(ROW, [outer]).ensureElements();
    const sign = bind(outer, 0);
    bind(innerA, 0);
    const innerElement = elementOf(innerA);
    elementTree.triggerEnqueueComponent(elementOf(outer), sign);

    expect(bind(outer, 1)).toBe(sign);

    expect(elementOf(innerB)).toBe(innerElement);
    expect(gSignMap[__GetElementUniqueID(innerElement)]).toBeDefined();
    // The kept list now serves B's source.
    const cell = gSignMap[__GetElementUniqueID(innerElement)]!.get(bind(innerB, 0))!;
    expect(cell.__listItemPlatformInfo?.['item-key']).toBe('b0');
  });

  it('keeps an untracked native nested list while other nested lists are tracked', () => {
    const tracked = list([keyedRow('t0')]);
    const trackedOuter = list([keyedRow('t', [tracked])]);
    node(ROW, [trackedOuter]).ensureElements();
    bind(trackedOuter, 0);
    expect(gSignMap[__GetElementUniqueID(elementOf(tracked))]).toBeDefined();
    vi.stubGlobal('__InvokeUIMethod', undefined);
    const innerA = list([keyedRow('a0')]);
    const innerB = list([keyedRow('b0')]);
    innerB.__listScrollOffset = { x: 40, y: 0 };
    const outer = list([keyedRow('a', [innerA]), keyedRow('b', [innerB])]);
    node(ROW, [outer]).ensureElements();
    const sign = bind(outer, 0);
    const innerElement = elementOf(innerA);
    elementTree.triggerEnqueueComponent(elementOf(outer), sign);

    expect(bind(outer, 1)).toBe(sign);

    expect(elementOf(innerB)).toBe(innerElement);
  });

  it.each(['scrolled donor', 'saved receiver', 'pending restore'] as const)(
    'gives the receiving item a new native nested list for a %s',
    reason => {
      const innerA = list([keyedRow('a0')]);
      const innerB = list([keyedRow('b0')]);
      const c = pendingRow('c', 0);
      const outer = list([keyedRow('a', [innerA]), keyedRow('b', [innerB]), c.row]);
      node(ROW, [outer]).ensureElements();
      if (reason === 'saved receiver') innerB.__listScrollOffset = { x: 40, y: 0 };
      const sign = bind(outer, 0);
      bind(innerA, 0);
      let donor = innerA;
      if (reason === 'scrolled donor') {
        __SetAttribute(elementOf(innerA), 'scroll-orientation', 'horizontal');
        emit(innerA, 'a0', 25);
      }
      if (reason === 'pending restore') {
        // C keeps A's list at zero, but native has not acknowledged C's restore yet.
        invoke.mockImplementation(() => {});
        const listA = elementOf(innerA);
        elementTree.triggerEnqueueComponent(elementOf(outer), sign);
        expect(bind(outer, 2)).toBe(sign);
        expect(elementOf(c.inner)).toBe(listA);
        expect(invoke.mock.calls.filter(([element]) => element === listA)).toHaveLength(1);
        donor = c.inner;
      }
      const donorElement = elementOf(donor);
      elementTree.triggerEnqueueComponent(elementOf(outer), sign);

      expect(bind(outer, 1)).toBe(sign);

      expect(elementOf(innerB)).not.toBe(donorElement);
    },
  );

  it('keeps visible nested lists and their offsets when a reload rehydrates with new IDs', () => {
    const inner = list([keyedRow('c0')]);
    const root = node(ROW, [list([keyedRow('a', [inner])])]);
    root.ensureElements();
    bind(root.childNodes[0]!, 0);
    __SetAttribute(elementOf(inner), 'scroll-orientation', 'horizontal');
    bind(inner, 0);
    emit(inner, 'c0', 50);
    const innerElement = elementOf(inner);

    const inner2 = list([keyedRow('c0')]);
    const root2 = node(ROW, [list([keyedRow('a', [inner2])])]);
    invoke.mockClear();
    hydrate(root, root2, { skipUnRef: true });
    __pendingListUpdates.flush();

    expect(elementOf(inner2)).toBe(innerElement);
    expect(inner2.__listScrollOffset).toEqual({ x: 50, y: 0 });
    expect(invoke.mock.calls.some(([, method]) => method === 'scrollToPosition')).toBe(false);
  });

  it('gives a recreated nested list its full source after offscreen edits', () => {
    const innerA = list([keyedRow('c0')]);
    const a = keyedRow('a', [innerA]);
    const b = pendingRow('b', 0);
    const outer = list([a, b.row]);
    node(ROW, [outer]).ensureElements();
    const signA = bind(outer, 0);
    bind(innerA, 0);
    elementTree.triggerEnqueueComponent(elementOf(outer), signA);
    expect(bind(outer, 1)).toBe(signA);
    expect(innerA.__elements).toBeUndefined();

    // The background edits A's inner list while A has no native list.
    innerA.insertBefore(keyedRow('c1'));
    __pendingListUpdates.flush();
    // A comes back with an empty outer pool, so its list is created again.
    bind(outer, 0);

    const info = (elementOf(innerA) as unknown as { props: Record<string, unknown> }).props['update-list-info'];
    const records = (Array.isArray(info) ? info : [info]) as { insertAction: Record<string, unknown>[] }[];
    expect(records.flatMap(record => record.insertAction.map(action => action['item-key']))).toEqual(['c0', 'c1']);
  });
});

describe('nested list same-owner rebinding', () => {
  it('keeps the legacy native list handoff when the host cannot track nested lists', () => {
    vi.stubGlobal('__InvokeUIMethod', undefined);
    const innerA = list([keyedRow('c0')]);
    const b = pendingRow('b', 30);
    const outer = list([keyedRow('a', [innerA]), b.row]);
    node(ROW, [outer]).ensureElements();
    const sign = bind(outer, 0);
    const innerElement = elementOf(innerA);
    elementTree.triggerEnqueueComponent(elementOf(outer), sign);

    expect(bind(outer, 1)).toBe(sign);
    expect(elementOf(b.inner)).toBe(innerElement);
    expect(invoke).not.toHaveBeenCalled();
  });

  it('keeps the native nested list and its cells when a moved row rebinds from its retained clone', () => {
    const innerA = list([keyedRow('c0')]);
    const a = keyedRow('a', [innerA]);
    const b = pendingRow('b', 0);
    const outer = list([a, b.row]);
    node(ROW, [outer]).ensureElements();
    const firstSign = bind(outer, 0);
    bind(innerA, 0);
    const innerElement = elementOf(innerA);
    const cellRoot = elementOf(innerA.childNodes[0]!);

    // A is requested again before its old row is enqueued, so the old native
    // row stays under a retained clone and A gets a second row.
    const secondSign = bind(outer, 0);
    expect(secondSign).not.toBe(firstSign);
    elementTree.triggerEnqueueComponent(elementOf(outer), secondSign);
    expect(bind(outer, 1)).toBe(secondSign);
    elementTree.triggerEnqueueComponent(elementOf(outer), firstSign);

    // A returns to its original native row through the retained clone.
    expect(bind(outer, 0)).toBe(firstSign);
    expect(elementOf(innerA)).toBe(innerElement);
    expect(elementOf(innerA.childNodes[0]!)).toBe(cellRoot);
    expect(gSignMap[__GetElementUniqueID(innerElement)]!.get(__GetElementUniqueID(cellRoot))).toBe(
      innerA.childNodes[0],
    );
  });
});
