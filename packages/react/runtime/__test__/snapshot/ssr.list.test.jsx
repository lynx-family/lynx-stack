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

function findSnapshot(element, snapshot = __root) {
  if (snapshot.__element_root === element) return snapshot;
  for (const child of snapshot.childNodes) {
    const found = findSnapshot(element, child);
    if (found) return found;
  }
}

function restoreSSR() {
  const page = __root.__element_root;
  const info = ssrEncode();
  clearPage();
  globalEnvManager.resetEnv();
  for (const element of ssrIDMap.values()) {
    if (element.type === 'list') {
      delete element.componentAtIndex;
      delete element.enqueueComponent;
      delete element.componentAtIndexes;
    }
  }
  vi.stubGlobal('__GetPageElement', () => page);
  vi.stubGlobal('__GetTemplateParts', () => Object.fromEntries(ssrIDMap));
  ssrHydrate(info);
  return page;
}

function StoreWithProduct({ shop }) {
  return (
    <view>
      <text>{shop.name}</text>
    </view>
  );
}

function ShopList({ shops }) {
  return (
    <list id='ssr-list' custom-list-name={undefined} scroll-orientation='horizontal'>
      {shops.map(shop => (
        <list-item key={shop.id} item-key={shop.id}>
          <StoreWithProduct shop={shop} />
        </list-item>
      ))}
    </list>
  );
}

// Compile the nested list inline so separation is performed by the default
// list transform, rather than by a user-authored component boundary.
function WrappedList({ shops, nested }) {
  const items = shops.map(shop => (
    <list-item key={shop.id} item-key={shop.id}>
      <StoreWithProduct shop={shop} />
    </list-item>
  ));
  return nested
    ? (
      <view>
        <view>
          <list id='ssr-list' custom-list-name={undefined}>{items}</list>
        </view>
      </view>
    )
    : (
      <view>
        <list id='ssr-list' custom-list-name={undefined}>{items}</list>
      </view>
    );
}

function createShops(count) {
  return Array.from({ length: count }, (_, index) => ({ id: `${index}`, name: `Shop ${index}` }));
}

describe.each([false, true])('SSR default list slots, nested=%s', nested => {
  it.each([0, 3])('restores callbacks and reuses %i items', count => {
    __root.__jsx = <WrappedList shops={createShops(count)} nested={nested} />;
    renderPage();
    const view = __root.childNodes[0].__element_root;
    const list = elementTree.getElementById('ssr-list');
    expect(findSnapshot(list).__snapshot_def.slot).toEqual([[DynamicPartType.ListSlotV2, 0]]);
    const signs = Array.from({ length: count }, (_, index) => elementTree.triggerComponentAtIndex(list, index));
    const items = [...list.children];
    const updateListCallbacks = vi.spyOn(globalThis, '__UpdateListCallbacks');
    const page = restoreSSR();

    expect(__root.childNodes[0].__element_root).toBe(view);
    expect(findSnapshot(list).__elements).toEqual([list]);
    expect(updateListCallbacks).toHaveBeenCalledTimes(1);
    expect(updateListCallbacks).toHaveBeenCalledWith(
      list,
      expect.any(Function),
      expect.any(Function),
      expect.any(Function),
    );
    expect(view.componentAtIndex).toBeUndefined();
    expect(gSignMap[__GetElementUniqueID(view)]).toBeUndefined();
    expect(gRecycleMap[__GetElementUniqueID(view)]).toBeUndefined();
    const listID = __GetElementUniqueID(list);
    expect(gSignMap[listID].size).toBe(count);
    expect(gRecycleMap[listID]).toBeInstanceOf(Map);
    signs.forEach((sign, index) => {
      const child = findSnapshot(list).childNodes[index];
      expect(gSignMap[listID].get(sign)).toBe(child);
      expect(gRecycleMap[listID].get(child.type).get(sign)).toBe(child);
      expect(elementTree.triggerComponentAtIndex(list, index)).toBe(sign);
      expect(child.__element_root).toBe(items[index]);
    });

    signs.forEach(sign => elementTree.triggerEnqueueComponent(list, sign));
    const indexes = signs.map((_, index) => index).reverse();
    const operationIDs = indexes.map(index => 100 + index);
    const flush = vi.spyOn(globalThis, '__FlushElementTree');
    elementTree.triggerComponentAtIndexes(list, indexes, operationIDs, false, false);
    expect(flush).toHaveBeenLastCalledWith(list, {
      triggerLayout: true,
      operationIDs,
      elementIDs: indexes.map(index => signs[index]),
      listID,
    });
    expect(list.children).toEqual(items);

    const remove = vi.spyOn(globalThis, '__RemoveElement');
    __root.__jsx = null;
    updatePage({});
    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith(page, view);
    expect(page.children).toEqual([]);
  });
});

it('preserves sibling slot indexes when updating a hydrated list', () => {
  function App({ shops, header }) {
    return (
      <view id='catalog'>
        {header && <text id='header'>{header}</text>}
        <text id='separator'>Products</text>
        <ShopList shops={shops} />
        <text id='footer'>Footer</text>
      </view>
    );
  }
  const shops = createShops(3);
  __root.__jsx = <App shops={shops} />;
  renderPage();
  const list = elementTree.getElementById('ssr-list');
  const catalog = elementTree.getElementById('catalog');
  const slotContainers = [...catalog.children];
  const footer = elementTree.getElementById('footer');
  const signs = shops.map((_, index) => elementTree.triggerComponentAtIndex(list, index));
  const listSlotIndex = findSnapshot(list).__slotIndex;
  expect(listSlotIndex).toBeGreaterThan(0);
  restoreSSR();
  expect(findSnapshot(list).__slotIndex).toBe(listSlotIndex);

  __root.__jsx = (
    <App shops={[{ ...shops[2], name: 'Updated shop' }, shops[0], { id: 'new', name: 'New shop' }]} header='Header' />
  );
  updatePage({});
  expect(elementTree.getElementById('ssr-list')).toBe(list);
  expect(elementTree.getElementById('footer')).toBe(footer);
  expect(catalog.children).toEqual(slotContainers);
  expect(slotContainers[0].children).toEqual([elementTree.getElementById('header')]);
  expect(slotContainers[2].children).toEqual([list]);
  expect(findSnapshot(list).childNodes.map(child => child.__listItemPlatformInfo['item-key'])).toEqual([
    '2',
    '0',
    'new',
  ]);
  expect(elementTree.triggerComponentAtIndex(list, 0)).toBe(signs[2]);
  expect(elementTree.triggerComponentAtIndex(list, 1)).toBe(signs[0]);
  expect(elementTree.triggerComponentAtIndex(list, 2)).toBe(signs[1]);
  expect(list.children.some(item => item.children[0]?.children[0]?.children[0]?.props.text === 'Updated shop')).toBe(
    true,
  );
});
