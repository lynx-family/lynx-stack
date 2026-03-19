import './jsdom.js';
import { describe, test, expect, beforeEach, beforeAll } from 'vitest';
import { createElementAPI } from '../ts/client/mainthread/elementAPIs/createElementAPI.js';
import { WASMJSBinding } from '../ts/client/mainthread/elementAPIs/WASMJSBinding.js';
import { vi } from 'vitest';
import { cssIdAttribute } from '../ts/constants.js';
import {
  createElementAPI as createServerElementAPI,
  SSRBinding,
} from '../ts/server/elementAPIs/createElementAPI.js';
import { wasmInstance } from '../ts/client/wasm.js';
import { encodeCSS } from '../ts/encode/encodeCSS.js';

describe('Element APIs', () => {
  let lynxViewDom: HTMLElement;
  let rootDom: ShadowRoot;
  let mtsGlobalThis: ReturnType<typeof createElementAPI>;
  let mtsBinding: WASMJSBinding;
  beforeEach(() => {
    vi.resetAllMocks();
    lynxViewDom = document.createElement('div') as unknown as HTMLElement;
    rootDom = lynxViewDom.attachShadow({ mode: 'open' });

    mtsBinding = new WASMJSBinding(
      vi.mockObject({
        rootDom,
        backgroundThread: vi.mockObject({
          publicComponentEvent: vi.fn(),
          publishEvent: vi.fn(),
          postTimingFlags: vi.fn(),
          markTiming: vi.fn(),
          flushTimingInfo: vi.fn(),
          jsContext: vi.mockObject({
            dispatchEvent: vi.fn(),
          }),
        } as any),
        exposureServices: vi.mockObject({
          updateExposureStatus: vi.fn(),
        }) as any,
        mainThreadGlobalThis: vi.mockObject({}) as any,
      }),
    );
    mtsGlobalThis = createElementAPI(
      rootDom,
      mtsBinding,
      true,
      true,
      true,
    );
  });
  test('createElementView', () => {
    const element = mtsGlobalThis.__CreateElement('view', 0);
    expect(mtsGlobalThis.__GetTag(element)).toBe('view');
  });
  test('__CreateComponent', () => {
    const ret = mtsGlobalThis.__CreateComponent(
      0,
      'id',
      0,
      'test_entry',
      'name',
      'path',
      {},
      {},
    );
    mtsGlobalThis.__UpdateComponentID(ret, 'id');
    expect(mtsGlobalThis.__GetComponentID(ret)).toBe('id');
    expect(mtsGlobalThis.__GetAttributeByName(ret, 'name')).toBe('name');
  });

  test('__CreateView', () => {
    const ret = mtsGlobalThis.__CreateView(0);
    expect(mtsGlobalThis.__GetTag(ret)).toBe('view');
  });

  test('__CreatePage tag reverse mapping', () => {
    const ret = mtsGlobalThis.__CreatePage('test', 0);
    // Even though it uses 'div' under the hood, __GetTag should reverse-map to 'page'
    expect(mtsGlobalThis.__GetTag(ret)).toBe('page');
  });

  test('__CreateScrollView', () => {
    const ret = mtsGlobalThis.__CreateScrollView(0);
    expect(mtsGlobalThis.__GetTag(ret)).toBe('scroll-view');
  });

  test('create-scroll-view-with-set-attribute', () => {
    let root = mtsGlobalThis.__CreatePage('page', 0);
    let ret = mtsGlobalThis.__CreateScrollView(0);
    mtsGlobalThis.__SetAttribute(ret, 'scroll-x', true);
    mtsGlobalThis.__AppendElement(root, ret);
    mtsGlobalThis.__FlushElementTree();
    expect(mtsGlobalThis.__GetAttributeByName(ret, 'scroll-x')).toBe('true');
    expect(rootDom.querySelector('scroll-view')?.getAttribute('scroll-x')).toBe(
      'true',
    );
  });

  test('__SetID', () => {
    let root = mtsGlobalThis.__CreatePage('page', 0);
    let ret = mtsGlobalThis.__CreateView(0);
    mtsGlobalThis.__SetID(ret, 'target');
    mtsGlobalThis.__AppendElement(root, ret);
    mtsGlobalThis.__FlushElementTree();
    expect(rootDom.querySelector('#target')).not.toBeNull();
  });

  test('__SetID to remove id', () => {
    let root = mtsGlobalThis.__CreatePage('page', 0);
    let ret = mtsGlobalThis.__CreateView(0);
    mtsGlobalThis.__SetID(ret, 'target');
    mtsGlobalThis.__AppendElement(root, ret);
    mtsGlobalThis.__FlushElementTree();
    expect(mtsGlobalThis.__GetAttributeByName(ret, 'id')).toBe('target');
    expect(rootDom.querySelector('#target')).not.toBeNull();
    mtsGlobalThis.__SetID(ret, null);
    expect(mtsGlobalThis.__GetAttributeByName(ret, 'id')).toBe(null);
    expect(rootDom.querySelector('#target')).toBeNull();
  });

  test('__CreateText', () => {
    const ret = mtsGlobalThis.__CreateText(0);
    expect(mtsGlobalThis.__GetTag(ret)).toBe('text');
  });

  test('__CreateImage', () => {
    const ret = mtsGlobalThis.__CreateImage(0);
    expect(mtsGlobalThis.__GetTag(ret)).toBe('image');
  });

  test('__CreateRawText', () => {
    const ret = mtsGlobalThis.__CreateRawText('content');
    expect(mtsGlobalThis.__GetTag(ret)).toBe('raw-text');
    expect(mtsGlobalThis.__GetAttributeByName(ret, 'text')).toBe('content');
  });

  test('__CreateWrapperElement', () => {
    const ret = mtsGlobalThis.__CreateWrapperElement(0);
    expect(mtsGlobalThis.__GetTag(ret)).toBe('wrapper');
  });

  test('__AppendElement-children-count', () => {
    let ret = mtsGlobalThis.__CreateView(0);
    let child_0 = mtsGlobalThis.__CreateView(0);
    let child_1 = mtsGlobalThis.__CreateView(0);
    mtsGlobalThis.__AppendElement(ret, child_0);
    mtsGlobalThis.__AppendElement(ret, child_1);
    expect(mtsGlobalThis.__GetChildren(ret).length).toBe(2);
  });

  test('__AppendElement-__RemoveElement', () => {
    let ret = mtsGlobalThis.__CreateView(0);
    let child_0 = mtsGlobalThis.__CreateView(0);
    let child_1 = mtsGlobalThis.__CreateView(0);
    mtsGlobalThis.__AppendElement(ret, child_0);
    mtsGlobalThis.__AppendElement(ret, child_1);
    mtsGlobalThis.__RemoveElement(ret, child_0);
    expect(mtsGlobalThis.__GetChildren(ret).length).toBe(1);
  });

  test('__InsertElementBefore', () => {
    let ret = mtsGlobalThis.__CreateView(0);
    let child_0 = mtsGlobalThis.__CreateView(0);
    let child_1 = mtsGlobalThis.__CreateImage(0);
    let child_2 = mtsGlobalThis.__CreateText(0);
    mtsGlobalThis.__InsertElementBefore(ret, child_0, null);
    mtsGlobalThis.__InsertElementBefore(ret, child_1, child_0);
    mtsGlobalThis.__InsertElementBefore(ret, child_2, child_1);
    const children = mtsGlobalThis.__GetChildren(ret);
    expect(children.length).toBe(3);
    expect(mtsGlobalThis.__GetTag(children[0]!)).toBe('text');
    expect(mtsGlobalThis.__GetTag(children[1]!)).toBe('image');
  });

  test('__FirstElement', () => {
    let root = mtsGlobalThis.__CreateView(0);
    let ret0 = mtsGlobalThis.__FirstElement(root);
    let child_0 = mtsGlobalThis.__CreateView(0);
    let child_1 = mtsGlobalThis.__CreateImage(0);
    let child_2 = mtsGlobalThis.__CreateText(0);
    mtsGlobalThis.__InsertElementBefore(root, child_0, null);
    mtsGlobalThis.__InsertElementBefore(root, child_1, child_0);
    mtsGlobalThis.__InsertElementBefore(root, child_2, child_1);
    let ret1 = mtsGlobalThis.__FirstElement(root);
    expect(ret0).toBeFalsy();
    expect(mtsGlobalThis.__GetTag(ret1!)).toBe('text');
  });

  test('__LastElement', () => {
    let root = mtsGlobalThis.__CreateView(0);
    let ret0 = mtsGlobalThis.__LastElement(root);
    let child_0 = mtsGlobalThis.__CreateView(0);
    let child_1 = mtsGlobalThis.__CreateImage(0);
    let child_2 = mtsGlobalThis.__CreateText(0);
    mtsGlobalThis.__InsertElementBefore(root, child_0, null);
    mtsGlobalThis.__InsertElementBefore(root, child_1, child_0);
    mtsGlobalThis.__InsertElementBefore(root, child_2, child_1);
    let ret1 = mtsGlobalThis.__LastElement(root);
    expect(ret0).toBeFalsy();
    expect(mtsGlobalThis.__GetTag(ret1!)).toBe('view');
  });

  test('__NextElement', () => {
    let root = mtsGlobalThis.__CreateView(0);
    let ret0 = mtsGlobalThis.__NextElement(root);
    let child_0 = mtsGlobalThis.__CreateView(0);
    let child_1 = mtsGlobalThis.__CreateImage(0);
    let child_2 = mtsGlobalThis.__CreateText(0);
    mtsGlobalThis.__InsertElementBefore(root, child_0, null);
    mtsGlobalThis.__InsertElementBefore(root, child_1, child_0);
    mtsGlobalThis.__InsertElementBefore(root, child_2, child_1);
    let ret1 = mtsGlobalThis.__NextElement(mtsGlobalThis.__FirstElement(root)!);
    expect(ret0).toBeFalsy();
    expect(mtsGlobalThis.__GetTag(ret1!)).toBe('image');
  });

  test('__ReplaceElement', () => {
    let root = mtsGlobalThis.__CreatePage('page', 0);
    let ret0 = mtsGlobalThis.__NextElement(root);
    let child_0 = mtsGlobalThis.__CreateView(0);
    let child_1 = mtsGlobalThis.__CreateImage(0);
    let child_2 = mtsGlobalThis.__CreateText(0);
    let child_3 = mtsGlobalThis.__CreateScrollView(0);
    mtsGlobalThis.__InsertElementBefore(root, child_0, null);
    mtsGlobalThis.__InsertElementBefore(root, child_1, child_0);
    mtsGlobalThis.__InsertElementBefore(root, child_2, child_1);
    mtsGlobalThis.__ReplaceElement(child_3, child_1);
    let ret1 = mtsGlobalThis.__NextElement(mtsGlobalThis.__FirstElement(root)!);
    mtsGlobalThis.__FlushElementTree();
    expect(ret0).toBeFalsy();
    expect(mtsGlobalThis.__GetTag(ret1!)).toBe('scroll-view');
  });

  test('__SwapElement', () => {
    let root = mtsGlobalThis.__CreateView(0);
    let ret = root;
    let ret0 = mtsGlobalThis.__NextElement(root);
    let child_0 = mtsGlobalThis.__CreateView(0);
    let child_1 = mtsGlobalThis.__CreateImage(0);
    let child_2 = mtsGlobalThis.__CreateText(0);
    mtsGlobalThis.__AppendElement(root, child_0);
    mtsGlobalThis.__AppendElement(root, child_1);
    mtsGlobalThis.__AppendElement(root, child_2);
    mtsGlobalThis.__SwapElement(child_0, child_1);
    const children = mtsGlobalThis.__GetChildren(ret);
    expect(ret0).toBeFalsy();
    expect(mtsGlobalThis.__GetTag(children[0]!)).toBe('image');
    expect(mtsGlobalThis.__GetTag(children[1]!)).toBe('view');
  });

  test('__GetParent', () => {
    let root = mtsGlobalThis.__CreateView(0);
    let ret0 = mtsGlobalThis.__NextElement(root);
    let child_0 = mtsGlobalThis.__CreateView(0);
    let child_1 = mtsGlobalThis.__CreateImage(0);
    let child_2 = mtsGlobalThis.__CreateText(0);
    mtsGlobalThis.__AppendElement(root, child_0);
    mtsGlobalThis.__AppendElement(root, child_1);
    mtsGlobalThis.__AppendElement(root, child_2);
    let ret1 = mtsGlobalThis.__GetParent(child_0);
    expect(ret1).toBeTruthy();
  });

  test('__GetChildren', () => {
    let root = mtsGlobalThis.__CreateView(0);
    let ret0 = mtsGlobalThis.__NextElement(root);
    let child_0 = mtsGlobalThis.__CreateView(0);
    let child_1 = mtsGlobalThis.__CreateImage(0);
    let child_2 = mtsGlobalThis.__CreateText(0);
    mtsGlobalThis.__AppendElement(root, child_0);
    mtsGlobalThis.__AppendElement(root, child_1);
    mtsGlobalThis.__AppendElement(root, child_2);
    let ret1 = mtsGlobalThis.__GetChildren(root);
    expect(ret0).toBeFalsy();
    expect(Array.isArray(ret1)).toBe(true);
    expect(ret1?.length).toBe(3);
  });

  test('__ElementIsEqual', () => {
    let node1 = mtsGlobalThis.__CreateView(0);
    let node2 = mtsGlobalThis.__CreateView(0);
    let node3 = node1;
    let ret0 = mtsGlobalThis.__ElementIsEqual(node1, node2);
    let ret1 = mtsGlobalThis.__ElementIsEqual(node1, node3);
    let ret2 = mtsGlobalThis.__ElementIsEqual(node1, null);
    expect(ret0).toBe(false);
    expect(ret1).toBe(true);
    expect(ret2).toBe(false);
  });

  test('__GetElementUniqueID', () => {
    let node1 = mtsGlobalThis.__CreateView(0);
    let node2 = mtsGlobalThis.__CreateView(0);
    let ret0 = mtsGlobalThis.__GetElementUniqueID(node1);
    let ret1 = mtsGlobalThis.__GetElementUniqueID(node2);
    expect(ret0 + 1).toBe(ret1);
  });

  test('__GetAttributes', () => {
    let node1 = mtsGlobalThis.__CreateText(0);
    mtsGlobalThis.__SetAttribute(node1, 'test', 'test-value');
    let attr_map = mtsGlobalThis.__GetAttributes(node1);
    expect(attr_map['test']).toEqual('test-value');
    let page = mtsGlobalThis.__CreatePage('page', 0);
    mtsGlobalThis.__AppendElement(page, node1);
    mtsGlobalThis.__FlushElementTree();
    expect(rootDom.querySelector('[test="test-value"]')).not.toBeNull();
  });

  test('__GetAttributeByName', () => {
    const page = mtsGlobalThis.__CreatePage('page', 0);
    mtsGlobalThis.__SetAttribute(page, 'test-attr', 'val');
    mtsGlobalThis.__FlushElementTree();
    expect(mtsGlobalThis.__GetAttributeByName(page, 'test-attr')).toBe('val');
    expect(
      rootDom.querySelector('[test-attr="val"]'),
    ).not.toBeNull();
  });

  test('__SetDataset', () => {
    let root = mtsGlobalThis.__CreatePage('page', 0);
    let node1 = mtsGlobalThis.__CreateText(0);
    mtsGlobalThis.__SetDataset(node1, { 'test': 'test-value' });
    let ret_0 = mtsGlobalThis.__GetDataset(node1);
    mtsGlobalThis.__AddDataset(node1, 'test1', 'test-value1');
    let ret_2 = mtsGlobalThis.__GetDataByKey(node1, 'test1');
    mtsGlobalThis.__AppendElement(root, node1);
    mtsGlobalThis.__AppendElement(root, node1);
    mtsGlobalThis.__FlushElementTree();
    expect(ret_0).toEqual({ 'test': 'test-value' });
    expect(ret_2).toBe('test-value1');
    expect(rootDom.querySelector('[data-test="test-value"]')).not.toBeNull();
    expect(rootDom.querySelector('[data-test1="test-value1"]')).not.toBeNull();
  });

  test('__GetClasses', () => {
    let root = mtsGlobalThis.__CreatePage('page', 0);
    let node1 = mtsGlobalThis.__CreateText(0);
    mtsGlobalThis.__AddClass(node1, 'a');
    mtsGlobalThis.__AddClass(node1, 'b');
    mtsGlobalThis.__AddClass(node1, 'c');
    let class_1 = mtsGlobalThis.__GetClasses(node1);
    expect(class_1.length).toBe(3);
    expect(class_1).toStrictEqual(['a', 'b', 'c']);
    mtsGlobalThis.__AppendElement(root, node1);
    mtsGlobalThis.__FlushElementTree();
    expect(rootDom.querySelector('[class="a b c"]')).not.toBeNull();
    mtsGlobalThis.__SetClasses(node1, 'c b a');
    let class_2 = mtsGlobalThis.__GetClasses(node1);
    mtsGlobalThis.__FlushElementTree();
    expect(class_2.length).toBe(3);
    expect(class_2).toStrictEqual(['c', 'b', 'a']);
  });

  test('__UpdateComponentID', () => {
    let e1 = mtsGlobalThis.__CreateComponent(
      0,
      'id1',
      0,
      'test_entry',
      'name',
      'path',
      {},
      {},
    );
    let e2 = mtsGlobalThis.__CreateComponent(
      0,
      'id2',
      0,
      'test_entry',
      'name',
      'path',
      {},
      {},
    );
    mtsGlobalThis.__UpdateComponentID(e1, 'id2');
    mtsGlobalThis.__UpdateComponentID(e2, 'id1');
    expect(mtsGlobalThis.__GetComponentID(e1)).toBe('id2');
    expect(mtsGlobalThis.__GetComponentID(e2)).toBe('id1');
  });

  test('__SetInlineStyles', () => {
    const root = mtsGlobalThis.__CreatePage('page', 0);
    let target = mtsGlobalThis.__CreateView(0);
    mtsGlobalThis.__SetID(target, 'target');
    mtsGlobalThis.__SetInlineStyles(target, undefined);
    mtsGlobalThis.__SetInlineStyles(target, {
      'margin': '10px',
      'marginTop': '20px',
      'marginLeft': '30px',
      'marginRight': '20px',
      'marginBottom': '10px',
    });
    mtsGlobalThis.__AppendElement(root, target);
    mtsGlobalThis.__FlushElementTree();
    const targetDom = rootDom.querySelector('#target') as HTMLElement;
    const targetStyle = targetDom.getAttribute('style');
    expect(targetStyle).toContain('20px');
    expect(targetStyle).toContain('30px');
    expect(targetStyle).toContain('10px');
  });

  test('__GetConfig__AddConfig', () => {
    let root = mtsGlobalThis.__CreatePage('page', 0);
    mtsGlobalThis.__AddConfig(root, 'key1', 'value1');
    mtsGlobalThis.__AddConfig(root, 'key2', 'value2');
    mtsGlobalThis.__AddConfig(root, 'key3', 'value3');
    mtsGlobalThis.__FlushElementTree();
    let config = mtsGlobalThis.__GetConfig(root);
    expect(config['key1']).toBe('value1');
    expect(config['key2']).toBe('value2');
    expect(config['key3']).toBe('value3');
  });

  test('__AddInlineStyle', () => {
    let root = mtsGlobalThis.__CreatePage('page', 0);
    mtsGlobalThis.__AddInlineStyle(root, 26, '80px');
    mtsGlobalThis.__FlushElementTree();
    expect(root.style.height).toBe('80px');
  });

  test('__AddInlineStyle_key_is_name', () => {
    let root = mtsGlobalThis.__CreatePage('page', 0);
    mtsGlobalThis.__AddInlineStyle(root, 'height', '80px');
    mtsGlobalThis.__FlushElementTree();
    expect(root.style.height).toBe('80px');
  });

  test('__AddInlineStyle_raw_string', () => {
    let root = mtsGlobalThis.__CreatePage('page', 0);
    mtsGlobalThis.__SetInlineStyles(root, 'height:80px');
    mtsGlobalThis.__FlushElementTree();
    expect(root.style.height).toBe('80px');
  });

  test('complicated_dom_tree_opt', () => {
    let root = mtsGlobalThis.__CreatePage('page', 0);

    let view_0 = mtsGlobalThis.__CreateView(0);
    let view_1 = mtsGlobalThis.__CreateView(0);
    let view_2 = mtsGlobalThis.__CreateView(0);
    mtsGlobalThis.__ReplaceElements(root, [view_0, view_1, view_2]!, null);

    expect(
      mtsGlobalThis.__ElementIsEqual(
        mtsGlobalThis.__GetChildren(root)![0]!,
        view_0,
      ),
    ).toBe(true);
    expect(
      mtsGlobalThis.__ElementIsEqual(
        mtsGlobalThis.__GetChildren(root)![1]!,
        view_1,
      ),
    ).toBe(true);
    expect(
      mtsGlobalThis.__ElementIsEqual(
        mtsGlobalThis.__GetChildren(root)![2]!,
        view_2,
      ),
    ).toBe(true);
    let view_3 = mtsGlobalThis.__CreateView(0);
    let view_4 = mtsGlobalThis.__CreateView(0);
    let view_5 = mtsGlobalThis.__CreateView(0);
    mtsGlobalThis.__ReplaceElements(root, [view_3, view_4, view_5]!, [
      view_0,
      view_1,
      view_2,
    ]);

    expect(
      mtsGlobalThis.__ElementIsEqual(
        mtsGlobalThis.__GetChildren(root)![0]!,
        view_3,
      ),
    ).toBe(true);
    expect(
      mtsGlobalThis.__ElementIsEqual(
        mtsGlobalThis.__GetChildren(root)![1]!,
        view_4,
      ),
    ).toBe(true);
    expect(
      mtsGlobalThis.__ElementIsEqual(
        mtsGlobalThis.__GetChildren(root)![2]!,
        view_5,
      ),
    ).toBe(true);
    mtsGlobalThis.__FlushElementTree();

    mtsGlobalThis.__ReplaceElements(root, [view_0, view_1, view_2]!, [
      view_3,
      view_4,
      view_5,
    ]);
    expect(
      mtsGlobalThis.__ElementIsEqual(
        mtsGlobalThis.__GetChildren(root)![0]!,
        view_0,
      ),
    ).toBe(true);
    expect(
      mtsGlobalThis.__ElementIsEqual(
        mtsGlobalThis.__GetChildren(root)![1]!,
        view_1,
      ),
    ).toBe(true);
    expect(
      mtsGlobalThis.__ElementIsEqual(
        mtsGlobalThis.__GetChildren(root)![2]!,
        view_2,
      ),
    ).toBe(true);
    expect(mtsGlobalThis.__GetChildren(root)!.length).toBe(3);

    mtsGlobalThis.__ReplaceElements(root, [view_0, view_1, view_2]!, [
      view_0,
      view_1,
      view_2,
    ]);
    expect(
      mtsGlobalThis.__ElementIsEqual(
        mtsGlobalThis.__GetChildren(root)![0]!,
        view_0,
      ),
    ).toBe(true);
    expect(
      mtsGlobalThis.__ElementIsEqual(
        mtsGlobalThis.__GetChildren(root)![1]!,
        view_1,
      ),
    ).toBe(true);
    expect(
      mtsGlobalThis.__ElementIsEqual(
        mtsGlobalThis.__GetChildren(root)![2]!,
        view_2,
      ),
    ).toBe(true);
    expect(mtsGlobalThis.__GetChildren(root)!.length).toBe(3);

    mtsGlobalThis.__ReplaceElements(root, [view_0, view_1, view_2]!, [
      view_0,
      view_1,
      view_2,
    ]);
    mtsGlobalThis.__ReplaceElements(root, [view_0, view_1, view_2]!, [
      view_0,
      view_1,
      view_2,
    ]);
    mtsGlobalThis.__ReplaceElements(root, [view_0, view_1, view_2]!, [
      view_0,
      view_1,
      view_2,
    ]);

    expect(
      mtsGlobalThis.__ElementIsEqual(
        mtsGlobalThis.__GetChildren(root)![0]!,
        view_0,
      ),
    ).toBe(true);
    expect(
      mtsGlobalThis.__ElementIsEqual(
        mtsGlobalThis.__GetChildren(root)![1]!,
        view_1,
      ),
    ).toBe(true);
    expect(
      mtsGlobalThis.__ElementIsEqual(
        mtsGlobalThis.__GetChildren(root)![2]!,
        view_2,
      ),
    ).toBe(true);
    mtsGlobalThis.__FlushElementTree();
  });

  test('__ReplaceElements', () => {
    let root = mtsGlobalThis.__CreatePage('page', 0);
    let view_0 = mtsGlobalThis.__CreateView(0);
    let view_1 = mtsGlobalThis.__CreateView(0);
    let view_2 = mtsGlobalThis.__CreateView(0);
    mtsGlobalThis.__ReplaceElements(root, [view_0, view_1, view_2]!, null);
    expect(mtsGlobalThis.__GetChildren(root)!.length).toBe(3);
    expect(
      mtsGlobalThis.__ElementIsEqual(
        mtsGlobalThis.__GetChildren(root)![0]!,
        view_0,
      ),
    ).toBe(true);
    expect(
      mtsGlobalThis.__ElementIsEqual(
        mtsGlobalThis.__GetChildren(root)![1]!,
        view_1,
      ),
    ).toBe(true);
    expect(
      mtsGlobalThis.__ElementIsEqual(
        mtsGlobalThis.__GetChildren(root)![2]!,
        view_2,
      ),
    ).toBe(true);
    mtsGlobalThis.__ReplaceElements(root, [view_2, view_1, view_0]!, [
      view_0,
      view_1,
      view_2,
    ]);
    expect(mtsGlobalThis.__GetChildren(root)!.length).toBe(3);
    expect(
      mtsGlobalThis.__ElementIsEqual(
        mtsGlobalThis.__GetChildren(root)![0]!,
        view_2,
      ),
    ).toBe(true);
    expect(
      mtsGlobalThis.__ElementIsEqual(
        mtsGlobalThis.__GetChildren(root)![1]!,
        view_1,
      ),
    ).toBe(true);
    expect(
      mtsGlobalThis.__ElementIsEqual(
        mtsGlobalThis.__GetChildren(root)![2]!,
        view_0,
      ),
    ).toBe(true);
    mtsGlobalThis.__FlushElementTree();
  });

  test('__ReplaceElements_2', () => {
    let res = true;
    let root = mtsGlobalThis.__CreatePage('page', 0);
    let view_0 = mtsGlobalThis.__CreateView(0);
    let view_1 = mtsGlobalThis.__CreateView(0);
    let view_2 = mtsGlobalThis.__CreateView(0);
    mtsGlobalThis.__ReplaceElements(root, [view_0, view_1, view_2]!, null);
    expect(mtsGlobalThis.__GetChildren(root)!.length).toBe(3);
    expect(
      mtsGlobalThis.__ElementIsEqual(
        mtsGlobalThis.__GetChildren(root)![0]!,
        view_0,
      ),
    ).toBe(true);
    expect(
      mtsGlobalThis.__ElementIsEqual(
        mtsGlobalThis.__GetChildren(root)![1]!,
        view_1,
      ),
    ).toBe(true);
    expect(
      mtsGlobalThis.__ElementIsEqual(
        mtsGlobalThis.__GetChildren(root)![2]!,
        view_2,
      ),
    ).toBe(true);
    mtsGlobalThis.__FlushElementTree();

    let view_3 = mtsGlobalThis.__CreateView(0);
    let view_4 = mtsGlobalThis.__CreateView(0);
    mtsGlobalThis.__ReplaceElements(root, [view_0, view_1, view_3, view_4]!, [
      view_0,
      view_1,
    ]);
    expect(mtsGlobalThis.__GetChildren(root)!.length).toBe(5);
    expect(
      mtsGlobalThis.__ElementIsEqual(
        mtsGlobalThis.__GetChildren(root)![0]!,
        view_0,
      ),
    ).toBe(true);
    expect(
      mtsGlobalThis.__ElementIsEqual(
        mtsGlobalThis.__GetChildren(root)![1]!,
        view_1,
      ),
    ).toBe(true);
    expect(
      mtsGlobalThis.__ElementIsEqual(
        mtsGlobalThis.__GetChildren(root)![2]!,
        view_3,
      ),
    ).toBe(true);
    expect(
      mtsGlobalThis.__ElementIsEqual(
        mtsGlobalThis.__GetChildren(root)![3]!,
        view_4,
      ),
    ).toBe(true);
    expect(
      mtsGlobalThis.__ElementIsEqual(
        mtsGlobalThis.__GetChildren(root)![4]!,
        view_2,
      ),
    ).toBe(true);
    mtsGlobalThis.__FlushElementTree();

    let view_5 = mtsGlobalThis.__CreateView(0);
    mtsGlobalThis.__ReplaceElements(root, [view_5]!, null);
    mtsGlobalThis.__FlushElementTree();
    expect(mtsGlobalThis.__GetChildren(root)!.length).toBe(6);
    expect(
      mtsGlobalThis.__ElementIsEqual(
        mtsGlobalThis.__GetChildren(root)![5]!,
        view_5,
      ),
    ).toBe(true);

    let view_6 = mtsGlobalThis.__CreateView(0);
    mtsGlobalThis.__ReplaceElements(root, [view_6], [view_3]);
    mtsGlobalThis.__FlushElementTree();

    expect(mtsGlobalThis.__GetChildren(root)!.length).toBe(6);
    expect(
      mtsGlobalThis.__ElementIsEqual(
        mtsGlobalThis.__GetChildren(root)![2]!,
        view_6,
      ),
    ).toBe(true);
    expect(
      mtsGlobalThis.__ElementIsEqual(
        mtsGlobalThis.__GetChildren(root)![3]!,
        view_4,
      ),
    ).toBe(true);
  });

  test('__ReplaceElements_3', () => {
    let root = mtsGlobalThis.__CreatePage('page', 0);
    let view_0 = mtsGlobalThis.__CreateView(0);
    let view_1 = mtsGlobalThis.__CreateView(0);
    let view_2 = mtsGlobalThis.__CreateView(0);
    let view_3 = mtsGlobalThis.__CreateView(0);
    let view_4 = mtsGlobalThis.__CreateView(0);
    mtsGlobalThis.__ReplaceElements(
      root,
      [view_0, view_1, view_2, view_3, view_4]!,
      null,
    );
    mtsGlobalThis.__FlushElementTree();
    expect(
      mtsGlobalThis.__ElementIsEqual(
        mtsGlobalThis.__GetChildren(root)![0]!,
        view_0,
      ),
    ).toBe(true);
    expect(
      mtsGlobalThis.__ElementIsEqual(
        mtsGlobalThis.__GetChildren(root)![1]!,
        view_1,
      ),
    ).toBe(true);
    expect(
      mtsGlobalThis.__ElementIsEqual(
        mtsGlobalThis.__GetChildren(root)![2]!,
        view_2,
      ),
    ).toBe(true);
    expect(
      mtsGlobalThis.__ElementIsEqual(
        mtsGlobalThis.__GetChildren(root)![3]!,
        view_3,
      ),
    ).toBe(true);
    expect(
      mtsGlobalThis.__ElementIsEqual(
        mtsGlobalThis.__GetChildren(root)![4]!,
        view_4,
      ),
    ).toBe(true);

    mtsGlobalThis.__ReplaceElements(root, [view_1, view_0, view_2]!, [
      view_0,
      view_1,
      view_2,
    ]);
    mtsGlobalThis.__FlushElementTree();
    expect(
      mtsGlobalThis.__ElementIsEqual(
        mtsGlobalThis.__GetChildren(root)![0]!,
        view_1,
      ),
    ).toBe(true);
    expect(
      mtsGlobalThis.__ElementIsEqual(
        mtsGlobalThis.__GetChildren(root)![1]!,
        view_0,
      ),
    ).toBe(true);
    expect(
      mtsGlobalThis.__ElementIsEqual(
        mtsGlobalThis.__GetChildren(root)![2]!,
        view_2,
      ),
    ).toBe(true);
    expect(
      mtsGlobalThis.__ElementIsEqual(
        mtsGlobalThis.__GetChildren(root)![3]!,
        view_3,
      ),
    ).toBe(true);
    expect(
      mtsGlobalThis.__ElementIsEqual(
        mtsGlobalThis.__GetChildren(root)![4]!,
        view_4,
      ),
    ).toBe(true);

    mtsGlobalThis.__ReplaceElements(root, [view_1, view_0, view_3, view_2]!, [
      view_1,
      view_0,
      view_2,
      view_3,
    ]);
    mtsGlobalThis.__FlushElementTree();
    expect(
      mtsGlobalThis.__ElementIsEqual(
        mtsGlobalThis.__GetChildren(root)![0]!,
        view_1,
      ),
    ).toBe(true);
    expect(
      mtsGlobalThis.__ElementIsEqual(
        mtsGlobalThis.__GetChildren(root)![1]!,
        view_0,
      ),
    ).toBe(true);
    expect(
      mtsGlobalThis.__ElementIsEqual(
        mtsGlobalThis.__GetChildren(root)![2]!,
        view_3,
      ),
    ).toBe(true);
    expect(
      mtsGlobalThis.__ElementIsEqual(
        mtsGlobalThis.__GetChildren(root)![3]!,
        view_2,
      ),
    ).toBe(true);
    expect(
      mtsGlobalThis.__ElementIsEqual(
        mtsGlobalThis.__GetChildren(root)![4]!,
        view_4,
      ),
    ).toBe(true);

    let view_5 = mtsGlobalThis.__CreateView(0);
    mtsGlobalThis.__ReplaceElements(root, [view_5]!, null);
    mtsGlobalThis.__FlushElementTree();
    expect(
      mtsGlobalThis.__ElementIsEqual(
        mtsGlobalThis.__GetChildren(root)![5]!,
        view_5,
      ),
    ).toBe(true);

    mtsGlobalThis.__ReplaceElements(
      root,
      [view_1, view_3, view_2, view_0, view_4]!,
      [view_1, view_0, view_3, view_2, view_4]!,
    );
    expect(
      mtsGlobalThis.__GetChildren(root),
    ).toStrictEqual([
      view_1,
      view_3,
      view_2,
      view_0,
      view_4,
      view_5,
    ]);
  });

  test('with_querySelector', () => {
    let page = mtsGlobalThis.__CreatePage('0', 0);
    let parent = mtsGlobalThis.__CreateComponent(
      0,
      'id1',
      0,
      'test_entry',
      'name',
      'path',
      {},
      {},
    );
    mtsGlobalThis.__AppendElement(page, parent);
    let child_0 = mtsGlobalThis.__CreateView(0);
    let child_1 = mtsGlobalThis.__CreateView(0);
    let child_component = mtsGlobalThis.__CreateComponent(
      mtsGlobalThis.__GetElementUniqueID(parent),
      'id2',
      0,
      'test_entry',
      'name',
      'path',
      {},
      {},
    );
    let child_2 = mtsGlobalThis.__CreateView(0);
    mtsGlobalThis.__AppendElement(parent, child_0);
    mtsGlobalThis.__AppendElement(parent, child_1);
    mtsGlobalThis.__AppendElement(parent, child_component);
    mtsGlobalThis.__AppendElement(child_component, child_2);
    mtsGlobalThis.__SetID(child_1, 'node_id');
    mtsGlobalThis.__SetID(child_2, 'node_id_2');

    mtsGlobalThis.__FlushElementTree();
    let ret_node = rootDom.querySelector('#node_id');
    let ret_id = ret_node?.getAttribute('id');

    let ret_u = rootDom.querySelector('#node_id_u');

    let ret_child = rootDom.querySelector('#node_id_2');
    let ret_child_id = ret_child?.getAttribute('id');

    expect(ret_id).toBe('node_id');
    expect(ret_u).toBe(null);
    expect(ret_child_id).toBe('node_id_2');
  });

  test('__setAttribute_null_value', () => {
    const ret = mtsGlobalThis.__CreatePage('page', 0);
    mtsGlobalThis.__SetAttribute(ret, 'test-attr', 'val');
    mtsGlobalThis.__SetAttribute(ret, 'test-attr', null);
    mtsGlobalThis.__FlushElementTree();
    expect(rootDom.querySelector('[test-attr="val"]')).toBeNull();
  });

  test('__ReplaceElements should accept not array', () => {
    let root = mtsGlobalThis.__CreatePage('page', 0);
    let ret0 = mtsGlobalThis.__NextElement(root);
    let child_0 = mtsGlobalThis.__CreateView(0);
    let child_1 = mtsGlobalThis.__CreateImage(0);
    let child_2 = mtsGlobalThis.__CreateText(0);
    let child_3 = mtsGlobalThis.__CreateScrollView(0);
    mtsGlobalThis.__InsertElementBefore(root, child_0, null);
    mtsGlobalThis.__InsertElementBefore(root, child_1, child_0);
    mtsGlobalThis.__InsertElementBefore(root, child_2, child_1);
    mtsGlobalThis.__AppendElement(root, child_3);
    mtsGlobalThis.__ReplaceElements(
      mtsGlobalThis.__GetParent(child_3)!,
      child_3,
      child_1,
    );
    mtsGlobalThis.__FlushElementTree();
    expect(
      mtsGlobalThis.__ElementIsEqual(
        mtsGlobalThis.__GetChildren(root)[0]!,
        child_2,
      ),
    ).toBe(true);
    expect(
      mtsGlobalThis.__ElementIsEqual(
        mtsGlobalThis.__GetChildren(root)[1]!,
        child_3,
      ),
    ).toBe(true);
    expect(
      mtsGlobalThis.__ElementIsEqual(
        mtsGlobalThis.__GetChildren(root)[2]!,
        child_0,
      ),
    ).toBe(true);
    let ret1 = mtsGlobalThis.__NextElement(mtsGlobalThis.__FirstElement(root)!);
    mtsGlobalThis.__ReplaceElements(
      mtsGlobalThis.__GetParent(child_1)!,
      child_1,
      child_1,
    );
    mtsGlobalThis.__ReplaceElements(
      mtsGlobalThis.__GetParent(child_1)!,
      child_1,
      child_1,
    );
    expect(ret0).toBeFalsy();
    expect(mtsGlobalThis.__GetTag(ret1!)).toBe('scroll-view');
  });

  test('create element infer css id from parent component id', () => {
    const root = mtsGlobalThis.__CreatePage('page', 0);
    const parentComponent = mtsGlobalThis.__CreateComponent(
      0,
      'id',
      100, // cssid
      'test_entry',
      'name',
      'path',
      {},
      {},
    );
    const parentComponentUniqueId = mtsGlobalThis.__GetElementUniqueID(
      parentComponent,
    );
    const view = mtsGlobalThis.__CreateText(parentComponentUniqueId);

    mtsGlobalThis.__AppendElement(root, view);
    mtsGlobalThis.__SetID(view, 'target');
    mtsGlobalThis.__AppendElement(root, parentComponent);
    mtsGlobalThis.__FlushElementTree();
    expect(rootDom.querySelector('#target')?.getAttribute(cssIdAttribute)).toBe(
      '100',
    );
  });

  test('create element wont infer for cssid 0', () => {
    const root = mtsGlobalThis.__CreatePage('page', 0);
    const parentComponent = mtsGlobalThis.__CreateComponent(
      0,
      'id',
      0, // cssid
      'test_entry',
      'name',
      'path',
      {},
      {},
    );
    const parentComponentUniqueId = mtsGlobalThis.__GetElementUniqueID(
      parentComponent,
    );
    const view = mtsGlobalThis.__CreateText(parentComponentUniqueId);

    mtsGlobalThis.__AppendElement(root, view);
    mtsGlobalThis.__SetID(view, 'target');
    mtsGlobalThis.__AppendElement(root, parentComponent);
    mtsGlobalThis.__FlushElementTree();
    expect(rootDom.querySelector('#target')?.hasAttribute(cssIdAttribute)).toBe(
      false,
    );
  });

  test('__GetElementUniqueID for incorrect fiber object', () => {
    const root = mtsGlobalThis.__CreatePage('page', 0);
    const parentComponent = mtsGlobalThis.__CreateComponent(
      0,
      'id',
      0, // cssid
      'test_entry',
      'name',
      'path',
      {},
      {},
    );
    const list = mtsGlobalThis.__CreateList(
      0,
      () => {},
      () => {},
    );
    mtsGlobalThis.__FlushElementTree();
    const rootId = mtsGlobalThis.__GetElementUniqueID(root);
    const parentComponentId = mtsGlobalThis.__GetElementUniqueID(
      parentComponent,
    );
    const listId = mtsGlobalThis.__GetElementUniqueID(list);
    // @ts-expect-error
    const nul = mtsGlobalThis.__GetElementUniqueID(null);
    // @ts-expect-error
    const undef = mtsGlobalThis.__GetElementUniqueID(undefined);
    const randomObject = mtsGlobalThis.__GetElementUniqueID({} as any);
    expect(rootId).toBeGreaterThanOrEqual(0);
    expect(parentComponentId).toBeGreaterThanOrEqual(0);
    expect(listId).toBeGreaterThanOrEqual(0);
    expect(nul).toBe(-1);
    expect(undef).toBe(-1);
    expect(randomObject).toBe(-1);
  });

  test('__AddInlineStyle_value_number_0', () => {
    const root = mtsGlobalThis.__CreatePage('page', 0);
    const view = mtsGlobalThis.__CreateView(0);
    mtsGlobalThis.__AddInlineStyle(root, 24, 'flex'); // display: flex
    mtsGlobalThis.__AddInlineStyle(view, 51, 0); // flex-shrink:0;
    mtsGlobalThis.__SetID(view, 'target');
    mtsGlobalThis.__AppendElement(root, view);
    mtsGlobalThis.__FlushElementTree();
    const inlineStyle = rootDom.querySelector('#target')?.getAttribute('style');
    expect(inlineStyle).toContain('flex-shrink');
  });

  test('event upper case `Tap` works', () => {
    vi.spyOn(mtsBinding, 'addEventListener');
    vi.spyOn(mtsBinding, 'publishEvent');
    let page = mtsGlobalThis.__CreatePage('0', 0);
    let parent = mtsGlobalThis.__CreateComponent(
      0,
      'id1',
      0,
      'test_entry',
      'name',
      'path',
      {},
      {},
    );
    let parentUid = mtsGlobalThis.__GetElementUniqueID(parent);
    let child = mtsGlobalThis.__CreateView(parentUid);
    mtsGlobalThis.__AppendElement(page, parent);
    mtsGlobalThis.__AppendElement(parent, child);
    mtsGlobalThis.__SetID(parent, 'parent_id');
    mtsGlobalThis.__SetID(child, 'child_id');
    mtsGlobalThis.__AddEvent(child, 'bindEvent', 'Tap', 'hname');
    mtsGlobalThis.__FlushElementTree();
    rootDom.querySelector('#child_id')?.dispatchEvent(
      new window.Event('click'),
    );
    expect(mtsBinding.addEventListener).toBeCalledTimes(1);
    expect(mtsBinding.addEventListener).toBeCalledWith('tap');
    expect(mtsBinding.publishEvent).toBeCalledTimes(1);
  });

  test('publicComponentEvent', () => {
    vi.spyOn(mtsBinding, 'addEventListener');
    vi.spyOn(mtsBinding, 'publishEvent');
    let page = mtsGlobalThis.__CreatePage('0', 0);
    let parent = mtsGlobalThis.__CreateComponent(
      0,
      'id1',
      0,
      'test_entry',
      'name',
      'path',
      {},
      {},
    );
    let parentUid = mtsGlobalThis.__GetElementUniqueID(parent);
    let child = mtsGlobalThis.__CreateView(parentUid);
    mtsGlobalThis.__AppendElement(page, parent);
    mtsGlobalThis.__AppendElement(parent, child);
    mtsGlobalThis.__SetID(parent, 'parent_id');
    mtsGlobalThis.__SetID(child, 'child_id');
    mtsGlobalThis.__AddEvent(child, 'bindEvent', 'tap', 'hname');
    mtsGlobalThis.__SetInlineStyles(parent, {
      'display': 'flex',
    });
    mtsGlobalThis.__SetInlineStyles(child, {
      'width': '100px',
      'height': '100px',
    });
    mtsGlobalThis.__FlushElementTree();
    rootDom.querySelector('#child_id')?.dispatchEvent(
      new window.Event('click'),
    );
    expect(mtsBinding.addEventListener).toBeCalledTimes(1);
    expect(mtsBinding.addEventListener).toBeCalledWith('tap');
    expect(mtsBinding.publishEvent).toBeCalledTimes(1);
    expect(mtsBinding.publishEvent).toBeCalledWith(
      'hname',
      'id1',
      expect.objectContaining({
        currentTarget: expect.objectContaining({
          id: 'child_id',
          dataset: expect.any(Object),
          uniqueId: expect.any(Number),
        }),
        target: expect.objectContaining({
          id: 'child_id',
          dataset: expect.any(Object),
          uniqueId: expect.any(Number),
        }),
      }),
      expect.any(Number),
      undefined,
      expect.any(Number),
      undefined,
    );
  });

  test('__UpdateComponentInfo', () => {
    let ele = mtsGlobalThis.__CreateComponent(
      0,
      'id1',
      0,
      'test_entry',
      'name1',
      'path',
      {},
      {},
    );
    mtsGlobalThis.__UpdateComponentInfo(ele, {
      componentID: 'id2',
      cssID: 8,
      name: 'name2',
    });
    const id = mtsGlobalThis.__GetComponentID(ele);
    const cssID = mtsGlobalThis.__GetAttributeByName(ele, cssIdAttribute);
    const name = mtsGlobalThis.__GetAttributeByName(ele, 'name');
    expect(id).toBe('id2');
    expect(cssID).toBe('8');
    expect(name).toBe('name2');
  });

  test('__MarkTemplate_and_Get_Parts', () => {
    /*
     * <view template> <!-- grand parent template -->
     *   <view part>
     *    <view template> <!-- target template -->
     *     <view> <!-- normal node -->
     *       <view part id="target"> <!-- target part -->
     *        <view template> <!-- sub template -->
     *         <view part> <!-- sub part, should be able to "get part" from the target -->
     *         </view>
     *       </view>
     *      </view>
     *     </view>
     *   </view>
     * </view>
     */
    const root = mtsGlobalThis.__CreatePage('page', 0);
    const grandParentTemplate = mtsGlobalThis.__CreateView(0);
    mtsGlobalThis.__MarkTemplateElement(grandParentTemplate);
    let view = mtsGlobalThis.__CreateView(0);
    mtsGlobalThis.__MarkPartElement(view, 'grandParentPart');
    mtsGlobalThis.__AppendElement(grandParentTemplate, view);
    const targetTemplate = mtsGlobalThis.__CreateView(0);
    mtsGlobalThis.__MarkTemplateElement(targetTemplate);
    mtsGlobalThis.__AppendElement(view, targetTemplate);
    view = mtsGlobalThis.__CreateView(0);
    mtsGlobalThis.__AppendElement(targetTemplate, view);
    const targetPart = mtsGlobalThis.__CreateView(0);
    mtsGlobalThis.__MarkPartElement(targetPart, 'targetPart');
    mtsGlobalThis.__AppendElement(view, targetPart);
    const subTemplate = mtsGlobalThis.__CreateView(0);
    mtsGlobalThis.__MarkTemplateElement(subTemplate);
    mtsGlobalThis.__AppendElement(targetPart, subTemplate);
    const subPart = mtsGlobalThis.__CreateView(0);
    mtsGlobalThis.__MarkPartElement(subPart, 'subPart');
    mtsGlobalThis.__AppendElement(subTemplate, subPart);
    mtsGlobalThis.__FlushElementTree();
    const targetPartLength = Object.keys(
      mtsGlobalThis.__GetTemplateParts(targetTemplate)!,
    ).length;
    const targetPartExist =
      mtsGlobalThis.__GetTemplateParts(targetTemplate)!['targetPart']
        === targetPart;
    expect(targetPartLength).toBe(1);
    expect(targetPartExist).toBe(true);
  });

  test('should optimize event enable/disable for whitelisted events', () => {
    const root = mtsGlobalThis.__CreatePage('page', 0);
    const element = mtsGlobalThis.__CreateScrollView(0);
    mtsGlobalThis.__AppendElement(root, element);

    const enableSpy = vi.spyOn(mtsBinding, 'enableElementEvent');
    const disableSpy = vi.spyOn(mtsBinding, 'disableElementEvent');

    mtsGlobalThis.__AddEvent(element, 'bindEvent', 'input', 'handler1');
    expect(enableSpy).toHaveBeenCalledTimes(1);
    expect(enableSpy).toHaveBeenCalledWith(expect.anything(), 'input');
    enableSpy.mockClear();

    mtsGlobalThis.__AddEvent(element, 'bindEvent', 'input', 'handler2');
    expect(enableSpy).not.toHaveBeenCalled();

    // 3. Remove first scroll listener (by setting null/undefined or however removal works)
    // __AddEvent doesn't explicitly support removal in the type signature shown in createElementAPI ??
    // Actually createElementAPI.__AddEvent just calls __wasm_add_event_bts.
    // To remove, we usually pass null/undefined as identifier?
    // Looking at createElementAPI.ts: if frameworkCrossThreadIdentifier == null, it calls with undefined.
    // But how to remove?
    // In Rust: replace_framework_cross_thread_event_handler takes Option<String>.
    // If we call __AddEvent with null identifier?

    // Let's check createElementAPI.ts again.
    // if (frameworkCrossThreadIdentifier == null) { wasmContext.__wasm_add_event_bts(..., undefined); ... }
    // So passing null/undefined removes it?
    // Wait, the Rust side: `replace_framework_cross_thread_event_handler` puts the new identifier.
    // If new identifier is None (from undefined), it removes.
    // But we need to target the *specific* event name.

    // Warning: `AddEventPAPI` signature usually implies adding.
    // "replace_framework_cross_thread_event_handler" suggests we REPLACE the handler for (event_name, event_type).
    // So there is only ONE "bindEvent" handler for "lynxscroll" at a time?
    // Use `event_apis.rs`: `framework_cross_thread_identifier: FnvHashMap<String, String>` where key is like "bind", "capture-bind".
    // So YES, for a given (event_name, type="bindEvent"), there is only ONE handler identifier.

    // So my test step 2 "Add second scroll listener" actually REPLACES the first one.
    // Rust logic:
    // Old: Some("handler1"), New: Some("handler2").
    // match (Some, Some) => nothing.
    // Correct.

    // 4. Remove listener.
    // Call __AddEvent with null identifier.
    mtsGlobalThis.__AddEvent(element, 'bindEvent', 'input', null as any);

    // Rust logic:
    // Old: Some("handler2"), New: None.
    // match (Some, None) => should_disable = true.
    expect(disableSpy).toHaveBeenCalledWith(expect.anything(), 'input');
  });

  test('should handle worklet events enable/disable', () => {
    const root = mtsGlobalThis.__CreatePage('page', 0);
    const element = mtsGlobalThis.__CreateView(0);
    mtsGlobalThis.__AppendElement(root, element);

    const enableSpy = vi.spyOn(mtsBinding, 'enableElementEvent');
    const disableSpy = vi.spyOn(mtsBinding, 'disableElementEvent');

    // Test add_run_worklet_event
    mtsGlobalThis.__AddEvent(
      element,
      'bindevent',
      'input',
      { name: 'worklet-handler' } as any,
    );
    expect(enableSpy).toHaveBeenCalledTimes(1);
    expect(enableSpy).toHaveBeenCalledWith(expect.anything(), 'input');
    enableSpy.mockClear();

    // Test get_events including worklet events
    const events = mtsGlobalThis.__GetEvents(element);
    // Assuming EventInfo struct matches JS object: { event_name, event_type, event_handler }
    // We check if we can find the added event
    const found = events.some((e: any) =>
      e.event_name === 'input' && e.event_type === 'bindevent'
    );
    expect(found).toBe(true);

    // Test removal (disable)
    mtsGlobalThis.__AddEvent(element, 'bindevent', 'input', null as any);
    expect(disableSpy).toHaveBeenCalledTimes(1);
    expect(disableSpy).toHaveBeenCalledWith(expect.anything(), 'input');
  });

  test('getClassList', () => {
    const root = mtsGlobalThis.__CreatePage('page', 0);
    const element = mtsGlobalThis.__CreateView(0);
    mtsGlobalThis.__AddClass(element, 'foo');
    mtsGlobalThis.__AddClass(element, 'bar');
    mtsGlobalThis.__AppendElement(root, element);

    const spy = vi.spyOn(mtsBinding, 'getClassList');
    const classes = mtsBinding.getClassList(element);

    expect(spy).toHaveBeenCalledWith(element);
    expect(classes).toEqual(expect.arrayContaining(['foo', 'bar']));
    expect(classes.length).toBe(2);
  });

  describe('Server Element APIs SSR Propagation', () => {
    test('create element infer css id from parent component in SSR', () => {
      const binding: SSRBinding = {
        ssrResult: '',
      };
      const config = {
        enableCSSSelector: true,
        defaultOverflowVisible: false,
        defaultDisplayLinear: true,
      };
      const { globalThisAPIs: api, wasmContext: wasmCtx } =
        createServerElementAPI(
          binding,
          undefined,
          '',
          config,
        );

      const root = api.__CreatePage('page', 0);
      const parentComponent = api.__CreateComponent(
        api.__GetElementUniqueID(root),
        'id',
        100,
        'test_entry',
        'name',
      );
      const parentComponentUniqueId = api.__GetElementUniqueID(parentComponent);
      const view = api.__CreateElement('view', parentComponentUniqueId);

      api.__AppendElement(parentComponent, view);
      api.__AppendElement(root, parentComponent);

      const viewUid = api.__GetElementUniqueID(view);
      const html = wasmCtx.generate_html(viewUid);

      expect(html).toContain('l-css-id="100"');
    });

    test('create element wont infer css id if parent css id is 0 in SSR', () => {
      const binding: SSRBinding = {
        ssrResult: '',
      };
      const config = {
        enableCSSSelector: true,
        defaultOverflowVisible: false,
        defaultDisplayLinear: true,
      };
      const { globalThisAPIs: api, wasmContext: wasmCtx } =
        createServerElementAPI(
          binding,
          undefined,
          '',
          config,
        );

      const root = api.__CreatePage('page', 0);
      const parentComponent = api.__CreateComponent(
        api.__GetElementUniqueID(root),
        'id',
        0,
        'test_entry',
        'name',
      );
      const parentComponentUniqueId = api.__GetElementUniqueID(parentComponent);
      const view = api.__CreateElement('view', parentComponentUniqueId);

      api.__AppendElement(parentComponent, view);
      api.__AppendElement(root, parentComponent);

      const viewUid = api.__GetElementUniqueID(view);
      const html = wasmCtx.generate_html(viewUid);
    });
  });

  test('push_style_sheet', () => {
    const { StyleSheetResource } = wasmInstance;
    const encodedRawStyleInfo = encodeCSS({
      '0': [
        {
          type: 'StyleRule',
          selectorText: { value: '.test' },
          style: [{ name: 'color', value: 'red' }],
          variables: {},
        },
      ],
    });
    const encodedStyleInfo = wasmInstance.decode_style_info(
      encodedRawStyleInfo,
      undefined,
      true,
    );
    const resource = new StyleSheetResource(encodedStyleInfo, document);
    mtsBinding.wasmContext!.push_style_sheet(resource);

    const page = mtsGlobalThis.__CreatePage('page', 0);
    const view = mtsGlobalThis.__CreateView(0);
    mtsGlobalThis.__AddClass(view, 'test');
    mtsGlobalThis.__AppendElement(page, view);
    mtsGlobalThis.__FlushElementTree();

    const styleElement = rootDom.querySelector('style');
    expect(styleElement).not.toBeNull();
    expect(styleElement!.textContent).toContain('.test');
    expect(styleElement!.textContent).toContain('color:red');
  });
});
