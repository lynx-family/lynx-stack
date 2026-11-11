/** @jsxImportSource ../../lepus */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { globalEnvManager } from './utils/envManager';
import { elementTree, options } from './utils/nativeMethod';
import { __root } from '../../src/root';
import { clearPage } from '../../src/snapshot';
import { gRecycleMap, gSignMap } from '../../src/snapshot/list/list';
import { DynamicPartType } from '../../src/snapshot/snapshot/dynamicPartType';

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
