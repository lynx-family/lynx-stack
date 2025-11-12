import { describe, test, expect, beforeEach } from 'vitest';
import { createMtsGlobalThis } from '../ts/createMtsGlobalThis.js';
import { GlobalWindow, Window } from 'happy-dom';
const window = new Window();
const document = window.document;
Object.assign(globalThis, { document, window, Window });
describe('Element APIs', () => {
  let lynxViewDom: HTMLElement;
  let rootDom: ShadowRoot;
  let mtsGlobalThis: ReturnType<typeof createMtsGlobalThis>;
  beforeEach(() => {
    lynxViewDom = document.createElement('div');
    rootDom = lynxViewDom.attachShadow({ mode: 'open' });
    mtsGlobalThis = createMtsGlobalThis(
      rootDom,
      {
        globalWindow: window,
      } as any,
      {} as any,
      {} as any,
      true,
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
      '',
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
    expect(mtsGlobalThis.__GetAttributeByName(ret, 'id')).toBe(undefined);
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
    expect(mtsGlobalThis.__GetTag(ret)).toBe('lynx-wrapper');
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
    expect(mtsGlobalThis.__GetTag(children[0])).toBe('text');
    expect(mtsGlobalThis.__GetTag(children[1])).toBe('image');
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
    mtsGlobalThis.__ReplaceElement(child_1, child_1);
    mtsGlobalThis.__ReplaceElement(child_1, child_1);
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
    expect(mtsGlobalThis.__GetTag(children[0])).toBe('image');
    expect(mtsGlobalThis.__GetTag(children[1])).toBe('view');
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
    expect(attr_map).toContainEqual(['test', 'test-value']);
  });

  test('__GetAttributeByName', () => {
    const page = mtsGlobalThis.__CreatePage('page', 0);
    mtsGlobalThis.__SetAttribute(page, 'test-attr', 'val');
    mtsGlobalThis.__FlushElementTree();
    expect(mtsGlobalThis.__GetAttributeByName(page, 'test-attr')).toBe('val');
  });

  test('__SetDataset', () => {
    let root = mtsGlobalThis.__CreatePage('page', 0);
    let node1 = mtsGlobalThis.__CreateText(0);
    mtsGlobalThis.__SetDataset(node1, { 'test': 'test-value' });
    let ret_0 = mtsGlobalThis.__GetDataset(node1);
    // mtsGlobalThis.__AddDataset(node1, 'test1', 'test-value1');
    // let ret_2 = mtsGlobalThis.__GetDataByKey(node1, 'test1');
    // mtsGlobalThis.__AppendElement(root, node1);
    // mtsGlobalThis.__AppendElement(root, node1);
    // mtsGlobalThis.__FlushElementTree();
    // expect(ret_0).toEqual({ 'test': 'test-value' });
    // expect(ret_2).toBe('test-value1');
  });

  //   test('__GetClasses', () => {
  //     let node1 = mtsGlobalThis.__CreateText(0);
  //     mtsGlobalThis.__AddClass(node1, 'a');
  //     mtsGlobalThis.__AddClass(node1, 'b');
  //     mtsGlobalThis.__AddClass(node1, 'c');
  //     let class_1 = mtsGlobalThis.__GetClasses(node1);
  //     mtsGlobalThis.__SetClasses(node1, 'c b a');
  //     let class_2 = mtsGlobalThis.__GetClasses(node1);
  //     expect(class_1.length).toBe(3);
  //     expect(class_1).toStrictEqual(['a', 'b', 'c']);
  //     expect(class_2.length).toBe(3);
  //     expect(class_2).toStrictEqual(['c', 'b', 'a']);
  //   });

  //   test('__UpdateComponentID', () => {
  //     let e1 = mtsGlobalThis.__CreateComponent(
  //       'test_entry',
  //       0,
  //       'name',
  //     );
  //     let e2 = mtsGlobalThis.__CreateComponent(
  //       'test_entry',
  //       0,
  //       'name',
  //     );
  //     mtsGlobalThis.__UpdateComponentID(e1, 'id2');
  //     mtsGlobalThis.__UpdateComponentID(e2, 'id1');
  //     expect(mtsGlobalThis.__GetComponentID(e1)).toBe('id2');
  //     expect(mtsGlobalThis.__GetComponentID(e2)).toBe('id1');
  //   });

  //   test('__SetInlineStyles', () => {
  //     const root = mtsGlobalThis.__CreatePage('page', 0);
  //     let target = mtsGlobalThis.__CreateView(0);
  //     mtsGlobalThis.__SetID(target, 'target');
  //     mtsGlobalThis.__SetInlineStyles(target, undefined);
  //     mtsGlobalThis.__SetInlineStyles(target, {
  //       'margin': '10px',
  //       'marginTop': '20px',
  //       'marginLeft': '30px',
  //       'marginRight': '20px',
  //       'marginBottom': '10px',
  //     });
  //     mtsGlobalThis.__AppendElement(root, target);
  //     const style = mtsGlobalThis.__GetStyle(target);
  //     expect(style.marginTop).toBe('20px');
  //     expect(style.marginLeft).toBe('30px');
  //     expect(style.marginRight).toBe('20px');
  //     expect(style.marginBottom).toBe('10px');
  //   });

  //   test('__GetConfig__AddConfig', () => {
  //     let root = mtsGlobalThis.__CreatePage('page', 0);
  //     mtsGlobalThis.__AddConfig(root, 'key1', 'value1');
  //     mtsGlobalThis.__AddConfig(root, 'key2', 'value2');
  //     mtsGlobalThis.__AddConfig(root, 'key3', 'value3');
  //     let config = mtsGlobalThis.__GetConfig(root);
  //     expect(config['key1']).toBe('value1');
  //     expect(config['key2']).toBe('value2');
  //     expect(config['key3']).toBe('value3');
  //   });

  //   test('__AddInlineStyle', () => {
  //     let root = mtsGlobalThis.__CreatePage('page', 0);
  //     mtsGlobalThis.__AddInlineStyle(root, 26, '80px');
  //     expect(mtsGlobalThis.__GetStyle(root).height).toBe('80px');
  //   });

  //   test('__AddInlineStyle_key_is_name', () => {
  //     let root = mtsGlobalThis.__CreatePage('page', 0);
  //     mtsGlobalThis.__AddInlineStyle(root, 'height', '80px');
  //     expect(mtsGlobalThis.__GetStyle(root).height).toBe('80px');
  //   });

  //   test('__AddInlineStyle_raw_string', () => {
  //     let root = mtsGlobalThis.__CreatePage('page', 0);
  //     mtsGlobalThis.__SetInlineStyles(root, 'height:80px');
  //     expect(mtsGlobalThis.__GetStyle(root).height).toBe('80px');
  //   });

  //   test('__UpdateComponentInfo', () => {
  //     let e1 = mtsGlobalThis.__CreateComponent(
  //       'test_entry',
  //       7,
  //       'name1',
  //     );
  //     mtsGlobalThis.__UpdateComponentInfo(e1, 'id2', 8);
  //     expect(mtsGlobalThis.__GetComponentID(e1)).toBe('id2');
  //     expect(mtsGlobalThis.__GetAttributeByName(e1, 'css-id')).toBe('8');
  //   });
  // });

  //   test('__UpdateComponentID', () => {
  //     let e1 = mtsGlobalThis.__CreateComponent(
  //       0,
  //       'id1',
  //       0,
  //       'test_entry',
  //       'name',
  //       'path',
  //       {},
  //     );
  //     let e2 = mtsGlobalThis.__CreateComponent(
  //       0,
  //       'id2',
  //       0,
  //       'test_entry',
  //       'name',
  //       'path',
  //       {},
  //     );
  //     mtsGlobalThis.__UpdateComponentID(e1, 'id2');
  //     mtsGlobalThis.__UpdateComponentID(e2, 'id1');
  //     expect(mtsGlobalThis.__GetComponentID(e1)).toBe('id2');
  //     expect(mtsGlobalThis.__GetComponentID(e2)).toBe('id1');
  //   });

  //   test('__SetInlineStyles', () => {
  //     const root = mtsGlobalThis.__CreatePage('page', 0);
  //     let target = mtsGlobalThis.__CreateView(0);
  //     mtsGlobalThis.__SetID(target, 'target');
  //     mtsGlobalThis.__SetInlineStyles(target, undefined);
  //     mtsGlobalThis.__SetInlineStyles(target, {
  //       'margin': '10px',
  //       'marginTop': '20px',
  //       'marginLeft': '30px',
  //       'marginRight': '20px',
  //       'marginBottom': '10px',
  //     });
  //     mtsGlobalThis.__AppendElement(root, target);
  //     mtsGlobalThis.__FlushElementTree();
  //     const targetStyle = root.querySelector('#target').getAttribute('style');
  //     expect(targetStyle).toContain('20px');
  //     expect(targetStyle).toContain('30px');
  //     expect(targetStyle).toContain('10px');
  //   });

  //   test('__GetConfig__AddConfig', () => {
  //     let root = mtsGlobalThis.__CreatePage('page', 0);
  //     mtsGlobalThis.__AddConfig(root, 'key1', 'value1');
  //     mtsGlobalThis.__AddConfig(root, 'key2', 'value2');
  //     mtsGlobalThis.__AddConfig(root, 'key3', 'value3');
  //     mtsGlobalThis.__FlushElementTree();
  //     let config = mtsGlobalThis.__GetConfig(root);
  //     expect(config.key1).toBe('value1');
  //     expect(config.key2).toBe('value2');
  //     expect(config.key3).toBe('value3');
  //   });

  //   test('__AddInlineStyle', () => {
  //     let root = mtsGlobalThis.__CreatePage('page', 0);
  //     mtsGlobalThis.__AddInlineStyle(root, 26, '80px');
  //     mtsGlobalThis.__FlushElementTree();
  //     expect(root.style.height).toBe('80px');
  //   });

  // t
  //   test('__AddInlineStyle_key_is_name', () => {
  //     let root = mtsGlobalThis.__CreatePage('page', 0);
  //     mtsGlobalThis.__AddInlineStyle(root, 'height', '80px');
  //     mtsGlobalThis.__FlushElementTree();
  //     expect(root.style.height).toBe('80px');
  //   });

  //   test('__AddInlineStyle_raw_string', () => {
  //     let root = mtsGlobalThis.__CreatePage('page', 0);
  //     mtsGlobalThis.__SetInlineStyles(root, 'height:80px');
  //     mtsGlobalThis.__FlushElementTree();
  //     expect(root.style.height).toBe('80px');
  //   });

  //   test('__UpdateComponentInfo', () => {
  //     let e1 = mtsGlobalThis.__CreateComponent(
  //       0,
  //       'id1',
  //       7,
  //       'test_entry',
  //       'name1',
  //       'path',
  //       {},
  //     );
  //     mtsGlobalThis.__UpdateComponentInfo(e1, 'id2', 8, 'name2');
  //     expect(mtsGlobalThis.__GetComponentID(e1)).toBe('id2');
  //     expect(e1.getAttribute('css-id')).toBe('8');
  //     expect(e1.getAttribute('name')).toBe('name2');
  //   });
});
