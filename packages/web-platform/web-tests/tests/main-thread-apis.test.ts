// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
// @ts-nocheck
import { componentIdAttribute, cssIdAttribute } from '@lynx-js/web-constants';
import { test, expect } from './coverage-fixture.js';
import type { Page } from '@playwright/test';

const wait = async (ms: number) => {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

test.describe('main thread api tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/main-thread-test.html`, {
      waitUntil: 'load',
    });
  });

  test.afterEach(async ({ page }) => {
    const fiberTree = await page.evaluate(() => {
      return globalThis.genFiberElementTree() as Record<string, unknown>;
    });
    const domTree = await page.evaluate(() => {
      return globalThis.genDomElementTree() as Record<string, unknown>;
    });
    expect(fiberTree).toStrictEqual(domTree);
  });

  test('createElementView', async ({ page }, { title }) => {
    const lynxTag = await page.evaluate(() => {
      const ret = globalThis.__CreateElement('view', 0) as HTMLElement;
      return globalThis.__GetTag(ret);
    });
    expect(lynxTag).toBe('view');
  });

  test('__CreateComponent', async ({ page }, { title }) => {
    const ret = await page.evaluate(() => {
      const ret = globalThis.__CreateComponent(
        0,
        'id',
        0,
        'test_entry',
        'name',
        'path',
        '',
        {},
      ) as HTMLElement;
      return {
        id: globalThis.__GetComponentID(ret),
        name: ret.getAttribute('name'),
      };
    });
    expect(ret.id).toBe('id');
    expect(ret.name).toBe('name');
  });

  test('__CreateView', async ({ page }, { title }) => {
    const lynxTag = await page.evaluate(() => {
      const ret = globalThis.__CreateView(0) as HTMLElement;
      return globalThis.__GetTag(ret);
    });
    expect(lynxTag).toBe('view');
  });

  test('__CreateScrollView', async ({ page }, { title }) => {
    const lynxTag = await page.evaluate(() => {
      const ret = globalThis.__CreateScrollView(0) as HTMLElement;
      return globalThis.__GetTag(ret);
    });
    expect(lynxTag).toBe('scroll-view');
  });

  test(
    'create-scroll-view-with-set-attribute',
    async ({ page, browserName }, { title }) => {
      const ret = await page.evaluate(() => {
        let root = globalThis.__CreatePage('page', 0);
        let ret = globalThis.__CreateScrollView(0);
        globalThis.__SetAttribute(ret, 'scroll-x', true);
        globalThis.__AppendElement(root, ret);
        globalThis.__FlushElementTree();
      });
      expect(page.locator('scroll-view')).toHaveAttribute('scroll-x', 'true');
    },
  );
  test(
    '__SetID',
    async ({ page, browserName }, { title }) => {
      const ret = await page.evaluate(() => {
        let root = globalThis.__CreatePage('page', 0);
        let ret = globalThis.__CreateView(0);
        globalThis.__SetID(ret, 'target');
        globalThis.__AppendElement(root, ret);
        globalThis.__FlushElementTree();
      });
      expect(await page.locator('#target').count()).toBe(1);
    },
  );
  test(
    '__SetID to remove id',
    async ({ page, browserName }, { title }) => {
      const ret = await page.evaluate(() => {
        let root = globalThis.__CreatePage('page', 0);
        let ret = globalThis.__CreateView(0);
        globalThis.__SetID(ret, 'target');
        globalThis.__AppendElement(root, ret);
        globalThis.__FlushElementTree();
        globalThis.view = ret;
      });
      expect(await page.locator('#target').count()).toBe(1);
      await page.evaluate(() => {
        let ret = globalThis.view;
        globalThis.__SetID(ret, null);
        globalThis.__FlushElementTree();
      });
      expect(await page.locator('#target').count()).toBe(0);
    },
  );

  test('__CreateText', async ({ page }, { title }) => {
    const lynxTag = await page.evaluate(() => {
      const ret = globalThis.__CreateText(0) as HTMLElement;
      return globalThis.__GetTag(ret);
    });
    expect(lynxTag).toBe('text');
  });

  test('__CreateImage', async ({ page }, { title }) => {
    const lynxTag = await page.evaluate(() => {
      const ret = globalThis.__CreateImage(0) as HTMLElement;
      return globalThis.__GetTag(ret);
    });
    expect(lynxTag).toBe('image');
  });

  test('__CreateRawText', async ({ page }, { title }) => {
    const lynxTag = await page.evaluate(() => {
      const ret = globalThis.__CreateRawText('content') as HTMLElement;
      return {
        tag: globalThis.__GetTag(ret),
        text: ret.getAttribute('text'),
      };
    });
    expect(lynxTag.tag).toBe('raw-text');
    expect(lynxTag.text).toBe('content');
  });

  test('__CreateWrapperElement', async ({ page }, { title }) => {
    const lynxTag = await page.evaluate(() => {
      const ret = globalThis.__CreateWrapperElement(0) as HTMLElement;
      return {
        tag: globalThis.__GetTag(ret),
      };
    });
    expect(lynxTag.tag).toBe('lynx-wrapper');
  });

  test('__AppendElement-chilren-count', async ({ page }, { title }) => {
    const count = await page.evaluate(() => {
      let ret = globalThis.__CreateView(0) as HTMLElement;
      let child_0 = globalThis.__CreateView(0);
      let child_1 = globalThis.__CreateView(0);
      globalThis.__AppendElement(ret, child_0);
      globalThis.__AppendElement(ret, child_1);
      return ret.children.length;
    });
    expect(count).toBe(2);
  });

  test('__AppendElement-__RemoveElement', async ({ page }, { title }) => {
    const count = await page.evaluate(() => {
      let ret = globalThis.__CreateView(0) as HTMLElement;
      let child_0 = globalThis.__CreateView(0);
      let child_1 = globalThis.__CreateView(0);
      globalThis.__AppendElement(ret, child_0);
      globalThis.__AppendElement(ret, child_1);
      globalThis.__RemoveElement(ret, child_0);
      return ret.children.length;
    });
    expect(count).toBe(1);
  });

  test('__InsertElementBefore', async ({ page }, { title }) => {
    const ret = await page.evaluate(() => {
      let ret = globalThis.__CreateView(0);
      let child_0 = globalThis.__CreateView(0);
      let child_1 = globalThis.__CreateImage(0);
      let child_2 = globalThis.__CreateText(0);
      globalThis.__InsertElementBefore(ret, child_0, undefined);
      globalThis.__InsertElementBefore(ret, child_1, child_0);
      globalThis.__InsertElementBefore(ret, child_2, child_1);
      return {
        count: ret.children.length,
        tags: [
          globalThis.__GetTag(ret.children[0]),
          globalThis.__GetTag(ret.children[1]),
          globalThis.__GetTag(ret.children[2]),
        ],
      };
    });
    expect(ret.count).toBe(3);
    expect(ret.tags[0]).toBe('text');
    expect(ret.tags[1]).toBe('image');
  });

  test('__FirstElement', async ({ page }, { title }) => {
    const ret = await page.evaluate(() => {
      let root = globalThis.__CreateView(0);
      let ret0 = globalThis.__FirstElement(root);
      let child_0 = globalThis.__CreateView(0);
      let child_1 = globalThis.__CreateImage(0);
      let child_2 = globalThis.__CreateText(0);
      globalThis.__InsertElementBefore(root, child_0, undefined);
      globalThis.__InsertElementBefore(root, child_1, child_0);
      globalThis.__InsertElementBefore(root, child_2, child_1);
      let ret1 = globalThis.__FirstElement(root);
      let ret_u = globalThis.__FirstElement('');
      return {
        ret0,
        ret_u,
        ret1: globalThis.__GetTag(ret1),
      };
    });
    expect(ret.ret0).toBeFalsy();
    expect(ret.ret_u).toBe(undefined);
    expect(ret.ret1).toBe('text');
  });

  test('__LastElement', async ({ page }, { title }) => {
    const ret = await page.evaluate(() => {
      let root = globalThis.__CreateView(0);
      let ret0 = globalThis.__LastElement(root);
      let child_0 = globalThis.__CreateView(0);
      let child_1 = globalThis.__CreateImage(0);
      let child_2 = globalThis.__CreateText(0);
      globalThis.__InsertElementBefore(root, child_0, undefined);
      globalThis.__InsertElementBefore(root, child_1, child_0);
      globalThis.__InsertElementBefore(root, child_2, child_1);
      let ret1 = globalThis.__LastElement(root);
      let ret_u = globalThis.__LastElement('xxxx');
      return {
        ret0,
        ret_u,
        ret1: globalThis.__GetTag(ret1),
      };
    });
    expect(ret.ret0).toBe(undefined);
    expect(ret.ret_u).toBe(undefined);
    expect(ret.ret1).toBe('view');
  });

  test('__NextElement', async ({ page }, { title }) => {
    const ret = await page.evaluate(() => {
      let root = globalThis.__CreateView(0);
      let ret0 = globalThis.__NextElement(root);
      let child_0 = globalThis.__CreateView(0);
      let child_1 = globalThis.__CreateImage(0);
      let child_2 = globalThis.__CreateText(0);
      globalThis.__InsertElementBefore(root, child_0, undefined);
      globalThis.__InsertElementBefore(root, child_1, child_0);
      globalThis.__InsertElementBefore(root, child_2, child_1);
      let ret1 = globalThis.__NextElement(globalThis.__FirstElement(root));
      let ret_u = globalThis.__NextElement('xxxx');
      return {
        ret0,
        ret_u,
        ret1: globalThis.__GetTag(ret1),
      };
    });
    expect(ret.ret0).toBe(undefined);
    expect(ret.ret_u).toBe(undefined);
    expect(ret.ret1).toBe('image');
  });

  test('__ReplaceElement', async ({ page }, { title }) => {
    const ret = await page.evaluate(() => {
      let root = globalThis.__CreatePage('page', 0);
      let ret0 = globalThis.__NextElement(root);
      let child_0 = globalThis.__CreateView(0);
      let child_1 = globalThis.__CreateImage(0);
      let child_2 = globalThis.__CreateText(0);
      let child_3 = globalThis.__CreateScrollView(0);
      globalThis.__InsertElementBefore(root, child_0, undefined);
      globalThis.__InsertElementBefore(root, child_1, child_0);
      globalThis.__InsertElementBefore(root, child_2, child_1);
      globalThis.__ReplaceElement(child_3, child_1);
      let ret1 = globalThis.__NextElement(globalThis.__FirstElement(root));
      globalThis.__FlushElementTree(root);
      globalThis.__ReplaceElement(child_1, child_1);
      globalThis.__ReplaceElement(child_1, child_1);
      return {
        ret0,
        ret1: globalThis.__GetTag(ret1),
      };
    });
    expect(ret.ret0).toBe(undefined);
    expect(ret.ret1).toBe('scroll-view');
  });

  test('__SwapElement', async ({ page }, { title }) => {
    const ret = await page.evaluate(() => {
      let root = globalThis.__CreateView(0);
      let ret = root;
      let ret0 = globalThis.__NextElement(root);
      let child_0 = globalThis.__CreateView(0);
      let child_1 = globalThis.__CreateImage(0);
      let child_2 = globalThis.__CreateText(0);
      globalThis.__AppendElement(root, child_0);
      globalThis.__AppendElement(root, child_1);
      globalThis.__AppendElement(root, child_2);
      globalThis.__SwapElement(child_0, child_1);
      return {
        ret0,
        ret_children: [
          globalThis.__GetTag(ret.children[0]),
          globalThis.__GetTag(ret.children[1]),
        ],
      };
    });
    expect(ret.ret0).toBe(undefined);
    expect(ret.ret_children[0]).toBe('image');
    expect(ret.ret_children[1]).toBe('view');
  });

  test('__GetParent', async ({ page }, { title }) => {
    const ret = await page.evaluate(() => {
      let root = globalThis.__CreateView(0);
      let ret0 = globalThis.__NextElement(root);
      let child_0 = globalThis.__CreateView(0);
      let child_1 = globalThis.__CreateImage(0);
      let child_2 = globalThis.__CreateText(0);
      globalThis.__AppendElement(root, child_0);
      globalThis.__AppendElement(root, child_1);
      globalThis.__AppendElement(root, child_2);
      let ret1 = globalThis.__GetParent(child_0);
      let ret_u = globalThis.__GetParent('xxxx');
      return {
        ret1: !!ret1,
        ret_u,
      };
    });
    expect(ret.ret1).toBe(true);
    expect(ret.ret_u).toBe(undefined);
  });

  test('__GetChildren', async ({ page }, { title }) => {
    const ret = await page.evaluate(() => {
      let root = globalThis.__CreateView(0);
      let ret0 = globalThis.__NextElement(root);
      let child_0 = globalThis.__CreateView(0);
      let child_1 = globalThis.__CreateImage(0);
      let child_2 = globalThis.__CreateText(0);
      globalThis.__AppendElement(root, child_0);
      globalThis.__AppendElement(root, child_1);
      globalThis.__AppendElement(root, child_2);
      let ret1 = globalThis.__GetChildren(root);
      let ret_u = globalThis.__GetChildren('xxxxx');
      return {
        ret0,
        ret1,
        ret_u,
      };
    });
    expect(ret.ret0).toBe(undefined);
    expect(ret.ret_u).toBe(undefined);
    expect(Array.isArray(ret.ret1)).toBe(true);
    expect(ret.ret1.length).toBe(3);
  });

  test('__ElementIsEqual', async ({ page }, { title }) => {
    const ret = await page.evaluate(() => {
      let node1 = globalThis.__CreateView(0);
      let node2 = globalThis.__CreateView(0);
      let node3 = node1;
      let ret0 = globalThis.__ElementIsEqual(node1, node2);
      let ret1 = globalThis.__ElementIsEqual(node1, node3);
      let ret2 = globalThis.__ElementIsEqual(node1, null);
      return {
        ret0,
        ret1,
        ret2,
      };
    });
    expect(ret.ret0).toBe(false);
    expect(ret.ret1).toBe(true);
    expect(ret.ret2).toBe(false);
  });

  test('__GetElementUniqueID', async ({ page }, { title }) => {
    const ret = await page.evaluate(() => {
      let node1 = globalThis.__CreateView(0);
      let node2 = globalThis.__CreateView(0);
      let ret0 = globalThis.__GetElementUniqueID(node1);
      let ret1 = globalThis.__GetElementUniqueID(node2);
      return {
        ret0,
        ret1,
      };
    });
    expect(ret.ret0 + 1).toBe(ret.ret1);
  });

  test('__GetAttributes', async ({ page }, { title }) => {
    const ret = await page.evaluate(() => {
      let node1 = globalThis.__CreateText(0);
      globalThis.__SetAttribute(node1, 'test', 'test-value');
      let attr_map = globalThis.__GetAttributes(node1);
      return attr_map;
    });
    expect(ret.test).toBe('test-value');
  });

  test('__SetDataset', async ({ page }, { title }) => {
    const ret = await page.evaluate(() => {
      let root = globalThis.__CreatePage('page', 0);
      let node1 = globalThis.__CreateText(0);
      globalThis.__SetDataset(node1, { 'test': 'test-value' });
      let ret_0 = globalThis.__GetDataset(node1);
      globalThis.__AddDataset(node1, 'test1', 'test-value1');
      let ret_2 = globalThis.__GetDataByKey(node1, 'test1');
      globalThis.__AppendElement(root, node1);
      globalThis.__AppendElement(root, node1);
      globalThis.__FlushElementTree();
      return {
        ret_0,
        ret_2,
      };
    });
    expect(ret.ret_0.test).toBe('test-value');
    expect(ret.ret_2).toBe('test-value1');
  });

  test('__GetClasses', async ({ page }, { title }) => {
    const ret = await page.evaluate(() => {
      let node1 = globalThis.__CreateText(0);
      globalThis.__AddClass(node1, 'a');
      globalThis.__AddClass(node1, 'b');
      globalThis.__AddClass(node1, 'c');
      let class_1 = globalThis.__GetClasses(node1);
      globalThis.__SetClasses(node1, 'c b a');
      let class_2 = globalThis.__GetClasses(node1);
      return {
        class_1,
        class_2,
      };
    });
    expect(ret.class_1.length).toBe(3);
    expect(ret.class_1).toStrictEqual(['a', 'b', 'c']);
    expect(ret.class_2.length).toBe(3);
    expect(ret.class_2).toStrictEqual(['c', 'b', 'a']);
  });

  test('__UpdateComponentID', async ({ page }, { title }) => {
    const ret = await page.evaluate(() => {
      let e1 = globalThis.__CreateComponent(
        0,
        'id1',
        0,
        'test_entry',
        'name',
        'path',
        {},
      );
      let e2 = globalThis.__CreateComponent(
        0,
        'id2',
        0,
        'test_entry',
        'name',
        'path',
        {},
      );
      globalThis.__UpdateComponentID(e1, 'id2');
      globalThis.__UpdateComponentID(e2, 'id1');
      return {
        id1: globalThis.__GetComponentID(e1),
        id2: globalThis.__GetComponentID(e2),
      };
    });
    expect(ret.id1).toBe('id2');
    expect(ret.id2).toBe('id1');
  });

  test('component-id-vs-parent-component-id', async ({ page }, { title }) => {
    const ret = await page.evaluate(() => {
      const root = globalThis.__CreatePage('page', 0);
      let e1 = globalThis.__CreateComponent(
        0,
        'id1',
        0,
        'test_entry',
        'name',
        'path',
        {},
      );
      globalThis.__AppendElement(root, e1);
      globalThis.__FlushElementTree();
      return;
    });
    const e1 = page.locator(`[${componentIdAttribute}="id1"]`);
  });

  test('__SetInlineStyles', async ({ page }, { title }) => {
    const ret = await page.evaluate(() => {
      let root = globalThis.__CreateView(0);
      globalThis.__SetInlineStyles(root, undefined);
      globalThis.__SetInlineStyles(root, {
        'margin': '10px',
        'marginTop': '20px',
        'marginLeft': '30px',
        'marginRight': '20px',
        'marginBottom': '10px',
      });
      return {
        inlineStyle: root.getAttribute('style'),
      };
    });
    expect(ret.inlineStyle).toContain('20px');
    expect(ret.inlineStyle).toContain('30px');
    expect(ret.inlineStyle).toContain('10px');
  });

  test('__GetConfig__AddConfig', async ({ page }, { title }) => {
    const ret = await page.evaluate(() => {
      let root = globalThis.__CreatePage('page', 0);
      globalThis.__AddConfig(root, 'key1', 'value1');
      globalThis.__AddConfig(root, 'key2', 'value2');
      globalThis.__AddConfig(root, 'key3', 'value3');
      globalThis.__FlushElementTree();
      let config = globalThis.__GetConfig(root);
      return {
        config,
      };
    });
    expect(ret.config.key1).toBe('value1');
    expect(ret.config.key2).toBe('value2');
    expect(ret.config.key3).toBe('value3');
  });

  test('__AddInlineStyle', async ({ page }, { title }) => {
    await page.evaluate(() => {
      let root = globalThis.__CreatePage('page', 0);
      globalThis.__AddInlineStyle(root, 26, '80px');
      globalThis.__FlushElementTree();
    });
    const pageElement = page.locator(`[lynx-tag='page']`);
    await expect(pageElement).toHaveCSS('height', '80px');
  });

  test('__AddInlineStyle_key_is_name', async ({ page }, { title }) => {
    await page.evaluate(() => {
      let root = globalThis.__CreatePage('page', 0);
      globalThis.__AddInlineStyle(root, 'height', '80px');
      globalThis.__FlushElementTree();
    });
    const pageElement = page.locator(`[lynx-tag='page']`);
    await expect(pageElement).toHaveCSS('height', '80px');
  });

  test('__AddInlineStyle_raw_string', async ({ page }, { title }) => {
    await page.evaluate(() => {
      let root = globalThis.__CreatePage('page', 0);
      globalThis.__SetInlineStyles(root, 'height:80px');
      globalThis.__FlushElementTree();
    });
    await expect(page.locator(`[lynx-tag='page']`)).toHaveCSS('height', '80px');
  });

  test('complicated_dom_tree_opt', async ({ page }, { title }) => {
    const ret = await page.evaluate(() => {
      let res = true;
      let root = globalThis.__CreatePage('page', 0);

      let view_0 = globalThis.__CreateView(0);
      let view_1 = globalThis.__CreateView(0);
      let view_2 = globalThis.__CreateView(0);
      globalThis.__ReplaceElements(root, [view_0, view_1, view_2], null);

      res = res
        && globalThis.__ElementIsEqual(
          globalThis.__GetChildren(root)[0],
          view_0,
        );
      res = res
        && globalThis.__ElementIsEqual(
          globalThis.__GetChildren(root)[1],
          view_1,
        );
      res = res
        && globalThis.__ElementIsEqual(
          globalThis.__GetChildren(root)[2],
          view_2,
        );
      let view_3 = globalThis.__CreateView(0);
      let view_4 = globalThis.__CreateView(0);
      let view_5 = globalThis.__CreateView(0);
      globalThis.__ReplaceElements(root, [view_3, view_4, view_5], [
        view_0,
        view_1,
        view_2,
      ]);

      res = res
        && globalThis.__ElementIsEqual(
          globalThis.__GetChildren(root)[0],
          view_3,
        );
      res = res
        && globalThis.__ElementIsEqual(
          globalThis.__GetChildren(root)[1],
          view_4,
        );
      res = res
        && globalThis.__ElementIsEqual(
          globalThis.__GetChildren(root)[2],
          view_5,
        );
      globalThis.__FlushElementTree(root);

      globalThis.__ReplaceElements(root, [view_0, view_1, view_2], [
        view_3,
        view_4,
        view_5,
      ]);
      globalThis.__ReplaceElements(root, [view_0, view_1, view_2], [
        view_0,
        view_1,
        view_2,
      ]);
      globalThis.__ReplaceElements(root, [view_0, view_1, view_2], [
        view_0,
        view_1,
        view_2,
      ]);
      globalThis.__ReplaceElements(root, [view_0, view_1, view_2], [
        view_0,
        view_1,
        view_2,
      ]);
      globalThis.__ReplaceElements(root, [view_0, view_1, view_2], [
        view_0,
        view_1,
        view_2,
      ]);
      res = res
        && globalThis.__ElementIsEqual(
          globalThis.__GetChildren(root)[0],
          view_0,
        );
      res = res
        && globalThis.__ElementIsEqual(
          globalThis.__GetChildren(root)[1],
          view_1,
        );
      res = res
        && globalThis.__ElementIsEqual(
          globalThis.__GetChildren(root)[2],
          view_2,
        );
      globalThis.__FlushElementTree(root);
      return {
        res,
      };
    });
    expect(ret.res).toBe(true);
  });

  test('__ReplaceElements', async ({ page }, { title }) => {
    const ret = await page.evaluate(() => {
      let res = true;
      let root = globalThis.__CreatePage('page', 0);
      let view_0 = globalThis.__CreateView(0);
      let view_1 = globalThis.__CreateView(0);
      let view_2 = globalThis.__CreateView(0);
      globalThis.__ReplaceElements(root, [view_0, view_1, view_2], null);
      res &&= globalThis.__ElementIsEqual(
        globalThis.__GetChildren(root)[0],
        view_0,
      );
      res &&= globalThis.__ElementIsEqual(
        globalThis.__GetChildren(root)[1],
        view_1,
      );
      res &&= globalThis.__ElementIsEqual(
        globalThis.__GetChildren(root)[2],
        view_2,
      );
      globalThis.__ReplaceElements(root, [view_2, view_1, view_0], [
        view_0,
        view_1,
        view_2,
      ]);
      res &&= globalThis.__ElementIsEqual(
        globalThis.__GetChildren(root)[0],
        view_2,
      );
      res &&= globalThis.__ElementIsEqual(
        globalThis.__GetChildren(root)[1],
        view_1,
      );
      res &&= globalThis.__ElementIsEqual(
        globalThis.__GetChildren(root)[2],
        view_0,
      );
      globalThis.__FlushElementTree();
      return {
        res,
      };
    });
    expect(ret.res).toBe(true);
  });

  test('__ReplaceElements_2', async ({ page }, { title }) => {
    const ret = await page.evaluate(() => {
      let res = true;
      let root = globalThis.__CreatePage('page', 0);
      let view_0 = globalThis.__CreateView(0);
      let view_1 = globalThis.__CreateView(0);
      let view_2 = globalThis.__CreateView(0);
      globalThis.__ReplaceElements(root, [view_0, view_1, view_2], null);
      res &&= globalThis.__ElementIsEqual(
        globalThis.__GetChildren(root)[0],
        view_0,
      );
      res &&= globalThis.__ElementIsEqual(
        globalThis.__GetChildren(root)[1],
        view_1,
      );
      res &&= globalThis.__ElementIsEqual(
        globalThis.__GetChildren(root)[2],
        view_2,
      );
      let view_3 = globalThis.__CreateView(0);
      let view_4 = globalThis.__CreateView(0);
      globalThis.__ReplaceElements(root, [view_0, view_1, view_3, view_4], [
        view_0,
        view_1,
      ]);
      res &&= globalThis.__ElementIsEqual(
        globalThis.__GetChildren(root)[0],
        view_0,
      );
      res &&= globalThis.__ElementIsEqual(
        globalThis.__GetChildren(root)[1],
        view_1,
      );
      res &&= globalThis.__ElementIsEqual(
        globalThis.__GetChildren(root)[2],
        view_3,
      );
      res &&= globalThis.__ElementIsEqual(
        globalThis.__GetChildren(root)[3],
        view_4,
      );
      res &&= globalThis.__ElementIsEqual(
        globalThis.__GetChildren(root)[4],
        view_2,
      );
      globalThis.__FlushElementTree(root);
      let view_5 = globalThis.__CreateView(0);
      globalThis.__ReplaceElements(root, [view_5], null);
      res &&= globalThis.__ElementIsEqual(
        globalThis.__GetChildren(root)[5],
        view_5,
      );
      globalThis.__FlushElementTree(root);
      let view_6 = globalThis.__CreateView(0);
      globalThis.__ReplaceElements(root, [view_6], [view_3]);
      globalThis.__FlushElementTree(root);
      res &&= globalThis.__ElementIsEqual(
        globalThis.__GetChildren(root)[2],
        view_6,
      );
      res &&= globalThis.__ElementIsEqual(
        globalThis.__GetChildren(root)[3],
        view_4,
      );
      return {
        res,
      };
    });
    expect(ret.res).toBe(true);
  });

  test('__ReplaceElements_3', async ({ page }, { title }) => {
    const ret = await page.evaluate(() => {
      let res = true;
      let root = globalThis.__CreatePage('page', 0);
      let view_0 = globalThis.__CreateView(0);
      let view_1 = globalThis.__CreateView(0);
      let view_2 = globalThis.__CreateView(0);
      let view_3 = globalThis.__CreateView(0);
      let view_4 = globalThis.__CreateView(0);
      globalThis.__ReplaceElements(root, [
        view_0,
        view_1,
        view_2,
        view_3,
        view_4,
      ], null);
      res = res
        && globalThis.__ElementIsEqual(
          globalThis.__GetChildren(root)[0],
          view_0,
        );
      res = res
        && globalThis.__ElementIsEqual(
          globalThis.__GetChildren(root)[1],
          view_1,
        );
      res = res
        && globalThis.__ElementIsEqual(
          globalThis.__GetChildren(root)[2],
          view_2,
        );
      res = res
        && globalThis.__ElementIsEqual(
          globalThis.__GetChildren(root)[3],
          view_3,
        );
      res = res
        && globalThis.__ElementIsEqual(
          globalThis.__GetChildren(root)[4],
          view_4,
        );
      globalThis.__FlushElementTree(root);

      globalThis.__ReplaceElements(root, [view_1, view_0, view_2], [
        view_0,
        view_1,
        view_2,
      ]);
      res = res
        && globalThis.__ElementIsEqual(
          globalThis.__GetChildren(root)[0],
          view_1,
        );
      res = res
        && globalThis.__ElementIsEqual(
          globalThis.__GetChildren(root)[1],
          view_0,
        );
      res = res
        && globalThis.__ElementIsEqual(
          globalThis.__GetChildren(root)[2],
          view_2,
        );
      res = res
        && globalThis.__ElementIsEqual(
          globalThis.__GetChildren(root)[3],
          view_3,
        );
      res = res
        && globalThis.__ElementIsEqual(
          globalThis.__GetChildren(root)[4],
          view_4,
        );
      globalThis.__FlushElementTree(root);

      globalThis.__ReplaceElements(root, [view_1, view_0, view_3, view_2], [
        view_1,
        view_0,
        view_2,
        view_3,
      ]);
      res = res
        && globalThis.__ElementIsEqual(
          globalThis.__GetChildren(root)[0],
          view_1,
        );
      res = res
        && globalThis.__ElementIsEqual(
          globalThis.__GetChildren(root)[1],
          view_0,
        );
      res = res
        && globalThis.__ElementIsEqual(
          globalThis.__GetChildren(root)[2],
          view_3,
        );
      res = res
        && globalThis.__ElementIsEqual(
          globalThis.__GetChildren(root)[3],
          view_2,
        );
      res = res
        && globalThis.__ElementIsEqual(
          globalThis.__GetChildren(root)[4],
          view_4,
        );
      globalThis.__FlushElementTree(root);

      let view_5 = globalThis.__CreateView(0);
      globalThis.__ReplaceElements(root, [view_5], null);
      res = res
        && globalThis.__ElementIsEqual(
          globalThis.__GetChildren(root)[5],
          view_5,
        );
      globalThis.__FlushElementTree(root);

      globalThis.__ReplaceElements(root, [
        view_1,
        view_3,
        view_2,
        view_0,
        view_4,
      ], [view_1, view_0, view_3, view_2, view_4]);
      res = res
        && globalThis.__ElementIsEqual(
          globalThis.__GetChildren(root)[0],
          view_1,
        );
      res = res
        && globalThis.__ElementIsEqual(
          globalThis.__GetChildren(root)[1],
          view_3,
        );
      res = res
        && globalThis.__ElementIsEqual(
          globalThis.__GetChildren(root)[2],
          view_2,
        );
      res = res
        && globalThis.__ElementIsEqual(
          globalThis.__GetChildren(root)[3],
          view_0,
        );
      res = res
        && globalThis.__ElementIsEqual(
          globalThis.__GetChildren(root)[4],
          view_4,
        );
      res = res
        && globalThis.__ElementIsEqual(
          globalThis.__GetChildren(root)[5],
          view_5,
        );
      globalThis.__FlushElementTree(root);
      return {
        res,
      };
    });
    expect(ret.res).toBe(true);
  });

  test('with_querySelector', async ({ page }, { title }) => {
    const ret = await page.evaluate(() => {
      let page = globalThis.__CreatePage('0', 0);
      let parent = globalThis.__CreateComponent(
        0,
        'id1',
        0,
        'test_entry',
        'name',
        'path',
        {},
      );
      globalThis.__AppendElement(page, parent);
      let child_0 = globalThis.__CreateView(0);
      let child_1 = globalThis.__CreateView(0);
      let child_component = globalThis.__CreateComponent(
        globalThis.__GetElementUniqueID(parent),
        'id2',
        0,
        'test_entry',
        'name',
        'path',
        {},
      );
      let child_2 = globalThis.__CreateView(0);
      globalThis.__AppendElement(parent, child_0);
      globalThis.__AppendElement(parent, child_1);
      globalThis.__AppendElement(parent, child_component);
      globalThis.__AppendElement(child_component, child_2);
      globalThis.__SetID(child_1, 'node_id');
      globalThis.__SetID(child_2, 'node_id_2');

      globalThis.__FlushElementTree();
      let ret_node = document.getElementById('root').shadowRoot.querySelector(
        '#node_id',
      );
      let ret_id = ret_node?.getAttribute('id');

      let ret_u = document.getElementById('root').shadowRoot.querySelector(
        '#node_id_u',
      );

      let ret_child = document.getElementById('root').shadowRoot.querySelector(
        '#node_id_2',
      );
      let ret_child_id = ret_child?.getAttribute('id');

      // let ret_child_u = parent.querySelector('#node_id_2');
      return {
        ret_id,
        ret_u,
        ret_child_id,
        // ret_child_u
      };
    });
    expect(ret.ret_id).toBe('node_id');
    expect(ret.ret_u).toBe(null);
    expect(ret.ret_child_id).toBe('node_id_2');
    // expect(ret.ret_child_u).toBe(null);
  });

  test('__setAttribute_null_value', async ({ page }, { title }) => {
    await page.evaluate(() => {
      const ret = globalThis.__CreatePage('page', 0);
      globalThis.__SetAttribute(ret, 'test-attr', 'val');
      globalThis.__SetAttribute(ret, 'test-attr', null);
      globalThis.__FlushElementTree();
    });
    await expect(page.locator(`[lynx-tag='page']`)).not.toHaveAttribute(
      'test-attr',
    );
  });

  test(
    '__ReplaceElements should accept not array',
    async ({ page }, { title }) => {
      const ret = await page.evaluate(() => {
        let root = globalThis.__CreatePage('page', 0);
        let ret0 = globalThis.__NextElement(root);
        let child_0 = globalThis.__CreateView(0);
        let child_1 = globalThis.__CreateImage(0);
        let child_2 = globalThis.__CreateText(0);
        let child_3 = globalThis.__CreateScrollView(0);
        globalThis.__InsertElementBefore(root, child_0, undefined);
        globalThis.__InsertElementBefore(root, child_1, child_0);
        globalThis.__InsertElementBefore(root, child_2, child_1);
        globalThis.__ReplaceElements(
          globalThis.__GetParent(child_3),
          child_3,
          child_1,
        );
        let ret1 = globalThis.__NextElement(globalThis.__FirstElement(root));
        globalThis.__FlushElementTree(root);
        globalThis.__ReplaceElements(
          globalThis.__GetParent(child_1),
          child_1,
          child_1,
        );
        globalThis.__ReplaceElements(
          globalThis.__GetParent(child_1),
          child_1,
          child_1,
        );
        return {
          ret0,
          ret1: globalThis.__GetTag(ret1),
        };
      });
      expect(ret.ret0).toBe(undefined);
      expect(ret.ret1).toBe('scroll-view');
    },
  );

  test(
    'create element infer css id from parent component id',
    async ({ page }, { title }) => {
      await wait(100);
      await page.evaluate(() => {
        const root = globalThis.__CreatePage('page', 0);
        const parentComponent = globalThis.__CreateComponent(
          0,
          'id',
          100, // cssid
          'test_entry',
          'name',
          'path',
          '',
          {},
        );
        const parentComponentUniqueId = __GetElementUniqueID(parentComponent);
        const view = globalThis.__CreateText(parentComponentUniqueId);

        globalThis.__AppendElement(root, view);
        globalThis.__SetID(view, 'target');
        globalThis.__AppendElement(root, parentComponent);
        globalThis.__FlushElementTree();
        return {};
      });
      await wait(100);
      await expect(page.locator('#target')).toHaveAttribute(
        cssIdAttribute,
        '100',
      );
    },
  );

  test(
    'create element wont infer for cssid 0',
    async ({ page }, { title }) => {
      await page.evaluate(() => {
        const root = globalThis.__CreatePage('page', 0);
        const parentComponent = globalThis.__CreateComponent(
          0,
          'id',
          0, // cssid
          'test_entry',
          'name',
          'path',
          '',
          {},
        );
        const parentComponentUniqueId = __GetElementUniqueID(parentComponent);
        const view = globalThis.__CreateText(parentComponentUniqueId);

        globalThis.__AppendElement(root, view);
        globalThis.__SetID(view, 'target');
        globalThis.__AppendElement(root, parentComponent);
        globalThis.__FlushElementTree();
        return {};
      });
      expect(page.locator('#target')).not.toHaveAttribute(cssIdAttribute);
    },
  );

  test(
    '__GetElementUniqueID for incorrect fiber object',
    async ({ page }, { title }) => {
      const ret = await page.evaluate(() => {
        const root = globalThis.__CreatePage('page', 0);
        const parentComponent = globalThis.__CreateComponent(
          0,
          'id',
          0, // cssid
          'test_entry',
          'name',
          'path',
          '',
          {},
        );
        const list = globalThis.__CreateList(0, () => {}, () => {});
        globalThis.__FlushElementTree();
        return {
          root: __GetElementUniqueID(root),
          parentComponent: __GetElementUniqueID(parentComponent),
          list: __GetElementUniqueID(list),
          nul: __GetElementUniqueID(null),
          undef: __GetElementUniqueID(undefined),
          randomObject: __GetElementUniqueID({}),
        };
      });
      const { root, parentComponent, list, nul, undef, randomObject } = ret;
      expect(root).toBeGreaterThanOrEqual(0);
      expect(parentComponent).toBeGreaterThanOrEqual(0);
      expect(list).toBeGreaterThanOrEqual(0);
      expect(nul).toBe(-1);
      expect(undef).toBe(-1);
      expect(randomObject).toBe(-1);
    },
  );

  test(
    '__AddInlineStyle_value_number_0',
    async ({ page }, { title }) => {
      await page.evaluate(() => {
        const root = globalThis.__CreatePage('page', 0);
        const view = globalThis.__CreateView(0);
        globalThis.__AddInlineStyle(root, 24, 'flex'); // display: flex
        globalThis.__AddInlineStyle(view, 51, 0); // flex-shrink:0;
        globalThis.__SetID(view, 'target');
        globalThis.__AppendElement(root, view);
        globalThis.__FlushElementTree();
        return {};
      });
      const inlineStyle = await page.locator('#target').getAttribute('style');
      expect(inlineStyle).toContain('flex-shrink');
    },
  );

  test('publicComponentEvent', async ({ page }, { title }) => {
    const ret = await page.evaluate(() => {
      let page = globalThis.__CreatePage('0', 0);
      let parent = globalThis.__CreateComponent(
        0,
        'id1',
        0,
        'test_entry',
        'name',
        'path',
        {},
      );
      let parentUid = globalThis.__GetElementUniqueID(parent);
      let child = globalThis.__CreateView(parentUid);
      globalThis.__AppendElement(page, parent);
      globalThis.__AppendElement(parent, child);
      globalThis.__SetID(parent, 'parent_id');
      globalThis.__SetID(child, 'child_id');
      globalThis.__AddEvent(child, 'bindEvent', 'tap', 'hname');
      globalThis.__SetInlineStyles(parent, {
        'display': 'flex',
      });
      globalThis.__SetInlineStyles(child, {
        'width': '100px',
        'height': '100px',
      });
      globalThis.__FlushElementTree();
    });
    await page.locator('#child_id').click({ force: true });
    await wait(100);
    const publicComponentEventArgs = await page.evaluate(() => {
      return globalThis.publicComponentEvent;
    });
    await expect(publicComponentEventArgs.hname).toBe('hname');
    await expect(publicComponentEventArgs.componentId).toBe('id1');
  });
});
