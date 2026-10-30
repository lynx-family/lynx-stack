/** @jsxImportSource ../../lepus */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { globalEnvManager } from './utils/envManager';
import { elementTree, options } from './utils/nativeMethod';
import { __root } from '../../src/root';
import { clearPage, SnapshotInstance } from '../../src/snapshot';
import { gRecycleMap, gSignMap } from '../../src/snapshot/list/list';
import { hydrate } from '../../src/snapshot/renderToOpcodes/hydrate';
import { DynamicPartType } from '../../src/snapshot/snapshot/dynamicPartType';
import { nestedListBridge } from '../../src/worklet-runtime/listEvent';

const ssrIDMap = new Map();

beforeEach(() => {
  globalEnvManager.resetEnv();
  elementTree.clear();
  let ssrID = 0;
  options.onCreateElement = element => {
    element.ssrID = `${ssrID++}`;
    element.toJSON = function() {
      return { ssrID: this.ssrID };
    };
    ssrIDMap.set(element.ssrID, element);
  };
});

afterEach(() => {
  delete options.onCreateElement;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  clearPage();
  globalEnvManager.resetEnv();
  elementTree.clear();
  ssrIDMap.clear();
});

// Legacy slot codegen keeps the surrounding views and list in one snapshot.
// The SSR path keeps custom-list-name undefined throughout hydration.
function WrappedList({ children }) {
  return (
    <view>
      <list id='ssr-list' custom-list-name={undefined} scroll-orientation='horizontal'>
        {children}
      </list>
    </view>
  );
}

function NestedWrappedList({ children }) {
  return (
    <view>
      <view>
        <list id='ssr-list' custom-list-name={undefined} scroll-orientation='horizontal'>
          {children}
        </list>
      </view>
    </view>
  );
}

function StoreWithProduct({ shop }) {
  return (
    <view>
      <text>{shop.name}</text>
    </view>
  );
}

describe.each([
  { List: WrappedList, listElementIndex: 1 },
  { List: NestedWrappedList, listElementIndex: 2 },
])('SSR list at element index $listElementIndex', ({ List, listElementIndex }) => {
  it.each([0, 3])('hydrates %i items on the list and preserves the snapshot root', itemCount => {
    const shops = Array.from({ length: itemCount }, (_, index) => ({ id: `${index}`, name: `Shop ${index}` }));
    function App() {
      return (
        <List>
          {shops.map(shop => (
            <list-item key={shop.id} item-key={shop.id}>
              <StoreWithProduct shop={shop} />
            </list-item>
          ))}
        </List>
      );
    }

    __root.__jsx = <App />;
    renderPage();

    const holder = __root.childNodes[0];
    const page = __root.__element_root;
    const view = holder.__element_root;
    const list = elementTree.getElementById('ssr-list');
    // Ensure this fixture exercises the coalesced snapshot from the regression.
    expect(holder.__snapshot_def.slot).toEqual([[DynamicPartType.ListChildren, listElementIndex]]);
    expect(holder.__elements[0]).toBe(view);
    expect(holder.__elements[listElementIndex]).toBe(list);
    expect(list.props['custom-list-name']).toBeUndefined();
    const signs = shops.map((_, index) => elementTree.triggerComponentAtIndex(list, index));
    const itemElements = [...list.children];
    const info = ssrEncode();

    clearPage();
    globalEnvManager.resetEnv();
    // Native SSR elements survive, but their server-side callbacks do not.
    delete list.componentAtIndex;
    delete list.enqueueComponent;
    delete list.componentAtIndexes;
    vi.stubGlobal('__GetPageElement', () => page);
    vi.stubGlobal('__GetTemplateParts', () => Object.fromEntries(ssrIDMap));
    const updateListCallbacks = vi.spyOn(globalThis, '__UpdateListCallbacks');

    ssrHydrate(info);

    const hydratedHolder = __root.childNodes[0];
    expect(hydratedHolder.__element_root).toBe(view);
    expect(hydratedHolder.__elements[listElementIndex]).toBe(list);
    expect(page.children).toEqual([view]);
    expect(list.props['custom-list-name']).toBeUndefined();
    expect(updateListCallbacks).toHaveBeenCalledTimes(1);
    expect(updateListCallbacks).toHaveBeenCalledWith(
      list,
      expect.any(Function),
      expect.any(Function),
      expect.any(Function),
    );
    for (const element of hydratedHolder.__elements.slice(0, listElementIndex)) {
      expect(element.componentAtIndex).toBeUndefined();
      expect(element.enqueueComponent).toBeUndefined();
      expect(element.componentAtIndexes).toBeUndefined();
      expect(gSignMap[__GetElementUniqueID(element)]).toBeUndefined();
      expect(gRecycleMap[__GetElementUniqueID(element)]).toBeUndefined();
    }

    const listID = __GetElementUniqueID(list);
    expect(gSignMap[listID].size).toBe(itemCount);
    expect(gRecycleMap[listID]).toBeInstanceOf(Map);
    signs.forEach((sign, index) => {
      const child = hydratedHolder.childNodes[index];
      expect(gSignMap[listID].get(sign)).toBe(child);
      expect(gRecycleMap[listID].get(child.type).get(sign)).toBe(child);
      expect(elementTree.triggerComponentAtIndex(list, index)).toBe(sign);
      expect(child.__element_root).toBe(itemElements[index]);
    });

    // Exercise recycling and the batch callback on the actual native list.
    signs.forEach(sign => elementTree.triggerEnqueueComponent(list, sign));
    const indexes = shops.map((_, index) => index).reverse();
    const operationIDs = indexes.map(index => 100 + index);
    const flushElementTree = vi.spyOn(globalThis, '__FlushElementTree');
    elementTree.triggerComponentAtIndexes(list, indexes, operationIDs, false, false);
    expect(flushElementTree).toHaveBeenLastCalledWith(list, {
      triggerLayout: true,
      operationIDs,
      elementIDs: indexes.map(index => signs[index]),
      listID,
    });
    expect(list.children).toEqual(itemElements);

    // Subsequent page updates must remove the outer view, not the inner list.
    const removeElement = vi.spyOn(globalThis, '__RemoveElement');
    __root.__jsx = null;
    updatePage({});
    expect(removeElement).toHaveBeenCalledTimes(1);
    expect(removeElement).toHaveBeenCalledWith(page, view);
    expect(page.children).toEqual([]);
  });
});

describe('coalesced nested-list cells', () => {
  const HOLE = null;
  const outerType = __SNAPSHOT__(<list id='coalesced-outer'>{HOLE}</list>);
  const holderType = __SNAPSHOT__(
    <list-item item-key={HOLE} className='coalesced-cell' style='min-height:17px'>
      <list id={HOLE} scroll-orientation='horizontal'>{HOLE}</list>
    </list-item>,
  );
  const leafType = __SNAPSHOT__(
    <list-item item-key={HOLE}>
      <text>Leaf</text>
    </list-item>,
  );

  it.each([2, 3])('keeps native cell signs and static styles while hydrating %i list levels', levels => {
    vi.stubGlobal('__InvokeUIMethod', vi.fn());
    const makeTree = () => {
      const outer = new SnapshotInstance(outerType);
      let parent = outer;
      for (let level = 1; level < levels; level++) {
        const holder = new SnapshotInstance(holderType);
        holder.setAttribute('values', [{ 'item-key': `row-${level}` }, `coalesced-inner-${level}`]);
        parent.insertBefore(holder);
        parent = holder;
      }
      const leaf = new SnapshotInstance(leafType);
      leaf.setAttribute(0, { 'item-key': 'leaf' });
      parent.insertBefore(leaf);
      return outer;
    };
    const before = makeTree();
    const after = makeTree();
    before.ensureElements();
    const retained = [];
    let owner = before;
    for (let level = 0; level < levels; level++) {
      const list = owner.__elements[owner.__snapshot_def.slot[0][1]];
      const sign = elementTree.triggerComponentAtIndex(list, 0);
      const child = owner.childNodes[0];
      retained.push({ list, sign, root: child.__element_root });
      if (child.__snapshot_def.isListHolder) {
        expect(child.__snapshot_def.slot).toEqual([[DynamicPartType.ListChildren, 1]]);
        expect(child.__element_root.props.class).toBe('coalesced-cell');
        expect(child.__element_root.props.style).toBe('min-height:17px');
      }
      owner = child;
    }

    expect(() => hydrate(before, after)).not.toThrow();
    owner = after;
    for (const { list, sign, root } of retained) {
      const listID = __GetElementUniqueID(list);
      const child = owner.childNodes[0];
      expect(owner.__elements[owner.__snapshot_def.slot[0][1]]).toBe(list);
      expect(child.__element_root).toBe(root);
      expect(list.children).toEqual([root]);
      expect(gSignMap[listID].get(sign)).toBe(child);
      if (child.__snapshot_def.isListHolder) {
        expect(root.props.class).toBe('coalesced-cell');
        expect(root.props.style).toBe('min-height:17px');
      }
      elementTree.triggerEnqueueComponent(list, sign);
      const key = child.type + (child.__listItemPlatformInfo?.['reuse-identifier'] ?? '');
      expect(gRecycleMap[listID].get(key).get(sign)).toBe(child);
      expect(elementTree.triggerComponentAtIndex(list, 0)).toBe(sign);
      owner = child;
    }
  });
});

it.each(['named', 'spread'])('forwards a legacy nested-list scroll handler after real SSR adoption (%s)', kind => {
  vi.stubGlobal('__InvokeUIMethod', vi.fn());
  const handler = { _lepusWorkletHash: 'legacy-ssr-scroll' };
  const children = [];
  function NestedList() {
    return kind === 'spread'
      ? <list id='ssr-event-inner' {...{ 'main-thread:bindscroll': handler }}>{children}</list>
      : <list id='ssr-event-inner' main-thread:bindscroll={handler}>{children}</list>;
  }
  __root.__jsx = (
    <list id='ssr-event-outer'>
      <list-item item-key='row'>
        <NestedList />
      </list-item>
    </list>
  );
  renderPage();
  const outer = elementTree.getElementById('ssr-event-outer');
  elementTree.triggerComponentAtIndex(outer, 0);
  const inner = elementTree.getElementById('ssr-event-inner');
  const page = __root.__element_root;
  const info = ssrEncode();
  expect(info).toContain('legacy-ssr-scroll');

  clearPage();
  globalEnvManager.resetEnv();
  for (const list of [outer, inner]) {
    delete list.componentAtIndex;
    delete list.enqueueComponent;
    delete list.componentAtIndexes;
  }
  vi.stubGlobal('__GetPageElement', () => page);
  vi.stubGlobal('__GetTemplateParts', () => Object.fromEntries(ssrIDMap));
  ssrHydrate(info);

  const run = vi.fn();
  nestedListBridge().dispatch(
    {
      listID: __GetElementUniqueID(inner),
      eventType: 'bindEvent',
      eventName: 'scroll',
    },
    [{ detail: { eventSource: 2, scrollLeft: 10, scrollTop: 0 } }],
    undefined,
    run,
  );
  expect(run).toHaveBeenCalledTimes(1);
  expect(run.mock.calls[0][0]).toMatchObject({ _lepusWorkletHash: 'legacy-ssr-scroll' });
});
