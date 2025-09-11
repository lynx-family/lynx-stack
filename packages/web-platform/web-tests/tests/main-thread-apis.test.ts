// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
// @ts-nocheck
import { componentIdAttribute, cssIdAttribute } from '@lynx-js/web-constants';
import { test, expect } from './coverage-fixture.js';
import type { Page } from '@playwright/test';

const ENABLE_MULTI_THREAD = !!process.env.ENABLE_MULTI_THREAD;
const isSSR = !!process.env['ENABLE_SSR'];

const wait = async (ms: number) => {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

test.describe('main thread api tests', () => {
  test.skip(isSSR, 'mts api tests not support ssr');
  test.beforeEach(async ({ page }) => {
    await page.goto(`/main-thread-test.html`, {
      waitUntil: 'domcontentloaded',
    });
    await wait(200);
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

  test('__AppendElement-children-count', async ({ page }, { title }) => {
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
    expect(ret.ret_u).toBeFalsy();
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
    expect(ret.ret0).toBeFalsy();
    expect(ret.ret_u).toBeFalsy();
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
    expect(ret.ret0).toBeFalsy();
    expect(ret.ret_u).toBeFalsy();
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
    expect(ret.ret0).toBeFalsy();
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
    expect(ret.ret0).toBeFalsy();
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
    expect(ret.ret0).toBeFalsy();
    expect(ret.ret_u).toBeFalsy();
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

  test('__GetAttributeByName', async ({ page }, { title }) => {
    const ret = await page.evaluate(() => {
      const page = globalThis.__CreatePage('page', 0);
      globalThis.__SetAttribute(page, 'test-attr', 'val');
      globalThis.__FlushElementTree();
      return globalThis.__GetAttributeByName(page, 'test-attr');
    });
    expect(ret).toBe('val');
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
    await page.evaluate(() => {
      const root = globalThis.__CreatePage('page', 0);
      let target = globalThis.__CreateView(0);
      globalThis.__SetID(target, 'target');
      globalThis.__SetInlineStyles(target, undefined);
      globalThis.__SetInlineStyles(target, {
        'margin': '10px',
        'marginTop': '20px',
        'marginLeft': '30px',
        'marginRight': '20px',
        'marginBottom': '10px',
      });
      globalThis.__AppendElement(root, target);
      globalThis.__FlushElementTree();
    });
    const targetStyle = await page.locator(`#target`).getAttribute('style');
    expect(targetStyle).toContain('20px');
    expect(targetStyle).toContain('30px');
    expect(targetStyle).toContain('10px');
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
      expect(ret.ret0).toBeFalsy();
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

  test(
    '__MarkTemplate_and_Get_Parts',
    async ({ page }, { title }) => {
      test.skip(ENABLE_MULTI_THREAD, 'NYI for multi-thread');
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
      const result = await page.evaluate(() => {
        const root = globalThis.__CreatePage('page', 0);
        const grandParentTemplate = globalThis.__CreateView(0);
        globalThis.__MarkTemplateElement(grandParentTemplate);
        let view = globalThis.__CreateView(0);
        globalThis.__MarkPartElement(view, 'grandParentPart');
        globalThis.__AppendElement(grandParentTemplate, view);
        const targetTemplate = globalThis.__CreateView(0);
        globalThis.__MarkTemplateElement(targetTemplate);
        globalThis.__AppendElement(view, targetTemplate);
        view = globalThis.__CreateView(0);
        globalThis.__AppendElement(targetTemplate, view);
        const targetPart = globalThis.__CreateView(0);
        globalThis.__MarkPartElement(targetPart, 'targetPart');
        globalThis.__AppendElement(view, targetPart);
        const subTemplate = globalThis.__CreateView(0);
        globalThis.__MarkTemplateElement(subTemplate);
        globalThis.__AppendElement(targetPart, subTemplate);
        const subPart = globalThis.__CreateView(0);
        globalThis.__MarkPartElement(subPart, 'subPart');
        globalThis.__AppendElement(subTemplate, subPart);
        globalThis.__FlushElementTree();
        return {
          targetPartLength:
            Object.keys(globalThis.__GetTemplateParts(targetTemplate)).length,
          targetPartExist:
            globalThis.__GetTemplateParts(targetTemplate)['targetPart']
              === targetPart,
        };
      });
      expect(result.targetPartLength).toBe(1);
      expect(result.targetPartExist).toBe(true);
    },
  );

  test.describe('__ElementFromBinary', () => {
    test('should create a basic element from template', async ({ page }) => {
      const result = await page.evaluate(() => {
        const element = globalThis.__ElementFromBinary('test-template', 0)[0];
        return {
          tag: globalThis.__GetTag(element),
        };
      });
      expect(result.tag).toBe('view');
    });

    test('should apply attributes from template', async ({ page }) => {
      const result = await page.evaluate(() => {
        const element = globalThis.__ElementFromBinary('test-template', 0)[0];
        return globalThis.__GetAttributes(element);
      });
      expect(result.attr1).toBe('value1');
    });

    test('should apply classes from template', async ({ page }) => {
      const result = await page.evaluate(() => {
        const element = globalThis.__ElementFromBinary('test-template', 0)[0];
        return globalThis.__GetClasses(element);
      });
      expect(result).toEqual(['class1', 'class2']);
    });

    test('should apply id from template', async ({ page }) => {
      const result = await page.evaluate(() => {
        const element = globalThis.__ElementFromBinary('test-template', 0)[0];
        return globalThis.__GetID(element);
      });
      expect(result).toBe('id-1');
    });

    test('should create child elements from template', async ({ page }) => {
      const result = await page.evaluate(() => {
        const element = globalThis.__ElementFromBinary('test-template', 0)[0];
        const child = globalThis.__FirstElement(element);
        return {
          childTag: globalThis.__GetTag(child),
          value: globalThis.__GetAttributes(child).value,
        };
      });
      expect(result.childTag).toBe('text');
      expect(result.value).toBe('Hello from template');
    });

    test('should apply events from template', async ({ page }) => {
      const result = await page.evaluate(() => {
        const element = globalThis.__ElementFromBinary('test-template', 0)[0];
        const events = globalThis.__GetEvents(element);
        return events;
      });
      expect(result.length).toBe(1);
      expect(result[0].name).toBe('tap');
      expect(result[0].type).toBe('bindEvent');
    });

    test('should mark part element', async ({ page }) => {
      test.skip(ENABLE_MULTI_THREAD, 'NYI for multi-thread');
      const result = await page.evaluate(() => {
        const element = globalThis.__ElementFromBinary('test-template', 0)[0];
        const child = globalThis.__FirstElement(element);
        return {
          targetPartLength:
            Object.keys(globalThis.__GetTemplateParts(element)).length,
          targetPartExist: globalThis.__GetTemplateParts(element)['id-2']
            === child,
        };
      });
      expect(result.targetPartLength).toBe(1);
      expect(result.targetPartExist).toBe(true);
    });

    test('should apply dataset from template', async ({ page }) => {
      const result = await page.evaluate(() => {
        const element = globalThis.__ElementFromBinary('test-template', 0)[0];
        return globalThis.__GetAttributes(element)['data-customdata'];
      });
      expect(result).toBe('customdata');
    });
  });

  test('__UpdateComponentInfo', async ({ page }, { title }) => {
    const ret = await page.evaluate(() => {
      let ele = globalThis.__CreateComponent(
        0,
        'id1',
        0,
        'test_entry',
        'name1',
        'path',
        {},
      );
      globalThis.__UpdateComponentInfo(ele, {
        componentID: 'id2',
        cssID: 8,
        name: 'name2',
      });
      globalThis.__UpdateComponentInfo(ele, 'id1');
      return {
        id: globalThis.__GetComponentID(ele),
        cssID: globalThis.__GetAttributes(ele)['l-css-id'],
        name: globalThis.__GetAttributes(ele).name,
      };
    });
    expect(ret.id).toBe('id2');
    expect(ret.cssID).toBe('8');
    expect(ret.name).toBe('name2');
  });

  test.describe('web-style-transformer tests', () => {
    test.beforeEach(async ({ page }) => {
      // Setup rpx variable for testing
      await page.evaluate(() => {
        // web render don't have element <lynx-view />, so we need to set the rpx variable manually
        const style = document.createElement('style');
        style.textContent = ':root { --rpx: 1px; }';
        document.head.appendChild(style);
      });
    });

    test.describe('rpx unit transformation', () => {
      test('basic rpx transformation', async ({ page }) => {
        await page.evaluate(() => {
          const root = globalThis.__CreatePage('page', 0);
          const view = globalThis.__CreateView(0);
          globalThis.__SetID(view, 'test-view');
          globalThis.__AddInlineStyle(view, 'width', '100rpx');
          globalThis.__AppendElement(root, view);
          globalThis.__FlushElementTree();
        });

        const viewElement = page.locator('#test-view');
        const style = await viewElement.getAttribute('style');
        expect(style).toContain('calc(100 * var(--rpx))');
        await expect(viewElement).toHaveCSS('width', '100px');
      });

      test('negative rpx values', async ({ page }) => {
        await page.evaluate(() => {
          const root = globalThis.__CreatePage('page', 0);
          const view = globalThis.__CreateView(0);
          globalThis.__SetID(view, 'test-view');
          globalThis.__AddInlineStyle(view, 'margin-left', '-10rpx');
          globalThis.__AppendElement(root, view);
          globalThis.__FlushElementTree();
        });

        const viewElement = page.locator('#test-view');
        const style = await viewElement.getAttribute('style');
        expect(style).toContain('calc(-10 * var(--rpx))');
        await expect(viewElement).toHaveCSS('margin-left', '-10px');
      });

      test('decimal rpx values', async ({ page }) => {
        await page.evaluate(() => {
          const root = globalThis.__CreatePage('page', 0);
          const view = globalThis.__CreateView(0);
          globalThis.__SetID(view, 'test-view');
          globalThis.__AddInlineStyle(view, 'width', '1.5rpx');
          globalThis.__AppendElement(root, view);
          globalThis.__FlushElementTree();
        });

        const viewElement = page.locator('#test-view');
        const style = await viewElement.getAttribute('style');
        expect(style).toContain('calc(1.5 * var(--rpx))');
        await expect(viewElement).toHaveCSS('width', '1.5px');
      });

      test('mixed units with rpx', async ({ page }) => {
        await page.evaluate(() => {
          const root = globalThis.__CreatePage('page', 0);
          const view = globalThis.__CreateView(0);
          globalThis.__SetID(view, 'test-view');
          globalThis.__SetInlineStyles(view, 'margin: 10px 5rpx 20px 15rpx');
          globalThis.__AppendElement(root, view);
          globalThis.__FlushElementTree();
        });

        const viewElement = page.locator('#test-view');
        const style = await viewElement.getAttribute('style');
        expect(style).toContain(
          '10px calc(5 * var(--rpx)) 20px calc(15 * var(--rpx))',
        );
        await expect(viewElement).toHaveCSS('margin-right', '5px');
        await expect(viewElement).toHaveCSS('margin-left', '15px');
      });

      test('rpx in multiple CSS properties', async ({ page }) => {
        await page.evaluate(() => {
          const root = globalThis.__CreatePage('page', 0);
          const view = globalThis.__CreateView(0);
          globalThis.__SetID(view, 'test-view');
          globalThis.__SetInlineStyles(view, {
            'width': '100rpx',
            'height': '50rpx',
            'padding': '5rpx',
            'margin': '10rpx 20rpx',
          });
          globalThis.__AppendElement(root, view);
          globalThis.__FlushElementTree();
        });

        const viewElement = page.locator('#test-view');
        const style = await viewElement.getAttribute('style');
        expect(style).toContain('calc(100 * var(--rpx))');
        expect(style).toContain('calc(50 * var(--rpx))');
        expect(style).toContain('calc(5 * var(--rpx))');
        expect(style).toContain('calc(10 * var(--rpx)) calc(20 * var(--rpx))');

        await expect(viewElement).toHaveCSS('width', '100px');
        await expect(viewElement).toHaveCSS('height', '50px');
        await expect(viewElement).toHaveCSS('padding', '5px');
      });

      test('rpx with !important', async ({ page }) => {
        await page.evaluate(() => {
          const root = globalThis.__CreatePage('page', 0);
          const view = globalThis.__CreateView(0);
          globalThis.__SetID(view, 'test-view');
          globalThis.__SetInlineStyles(view, 'width: 100rpx !important');
          globalThis.__AppendElement(root, view);
          globalThis.__FlushElementTree();
        });

        const viewElement = page.locator('#test-view');
        const style = await viewElement.getAttribute('style');
        expect(style).toContain('calc(100 * var(--rpx)) !important');
        await expect(viewElement).toHaveCSS('width', '100px');
      });

      test('zero rpx values', async ({ page }) => {
        await page.evaluate(() => {
          const root = globalThis.__CreatePage('page', 0);
          const view = globalThis.__CreateView(0);
          globalThis.__SetID(view, 'test-view');
          globalThis.__AddInlineStyle(view, 'margin', '0rpx');
          globalThis.__AppendElement(root, view);
          globalThis.__FlushElementTree();
        });

        const viewElement = page.locator('#test-view');
        const style = await viewElement.getAttribute('style');
        expect(style).toContain('calc(0 * var(--rpx))');
        await expect(viewElement).toHaveCSS('margin', '0px');
      });
    });

    test.describe('rpx edge cases', () => {
      test('rpx in url should not be transformed', async ({ page }) => {
        await page.evaluate(() => {
          const root = globalThis.__CreatePage('page', 0);
          const view = globalThis.__CreateView(0);
          globalThis.__SetID(view, 'test-view');
          globalThis.__SetInlineStyles(
            view,
            'background-image: url(image-1rpx.png)',
          );
          globalThis.__AppendElement(root, view);
          globalThis.__FlushElementTree();
        });

        const viewElement = page.locator('#test-view');
        const style = await viewElement.getAttribute('style');
        expect(style).toContain('url(image-1rpx.png)');
        expect(style).not.toContain('calc');
      });

      test('rpx in string should not be transformed', async ({ page }) => {
        await page.evaluate(() => {
          const root = globalThis.__CreatePage('page', 0);
          const view = globalThis.__CreateView(0);
          globalThis.__SetID(view, 'test-view');
          globalThis.__SetInlineStyles(view, 'content: "text with 1rpx"');
          globalThis.__AppendElement(root, view);
          globalThis.__FlushElementTree();
        });

        const viewElement = page.locator('#test-view');
        const style = await viewElement.getAttribute('style');
        expect(style).toContain('"text with 1rpx"');
        expect(style).not.toContain('calc');
      });

      test('non-rpx units should remain unchanged', async ({ page }) => {
        await page.evaluate(() => {
          const root = globalThis.__CreatePage('page', 0);
          const view = globalThis.__CreateView(0);
          globalThis.__SetID(view, 'test-view');
          globalThis.__SetInlineStyles(view, {
            'width': '100px',
            'height': '50%',
            'margin': '10em',
            'padding': '5rem',
          });
          globalThis.__AppendElement(root, view);
          globalThis.__FlushElementTree();
        });

        const viewElement = page.locator('#test-view');
        const style = await viewElement.getAttribute('style');
        expect(style).toContain('100px');
        expect(style).toContain('50%');
        expect(style).toContain('10em');
        expect(style).toContain('5rem');
        expect(style).not.toContain('calc');
      });

      test('rpx in identifiers should not be transformed', async ({ page }) => {
        await page.evaluate(() => {
          const root = globalThis.__CreatePage('page', 0);
          const view = globalThis.__CreateView(0);
          globalThis.__SetID(view, 'test-view');
          globalThis.__SetInlineStyles(
            view,
            'background: sprite-1RPX-icon 1rpx;',
          );
          globalThis.__AppendElement(root, view);
          globalThis.__FlushElementTree();
        });

        const viewElement = page.locator('#test-view');
        const style = await viewElement.getAttribute('style');
        // The identifier sprite-1RPX-icon should remain unchanged
        expect(style).toContain('sprite-1RPX-icon');
        // Only the trailing 1rpx should be transformed
        expect(style).toContain('calc(1 * var(--rpx))');
        // Should not contain calc for the identifier part
        expect(style).not.toContain('calc(sprite-1RPX-icon');
      });

      test('rpx in various identifier contexts should not be transformed', async ({ page }) => {
        await page.evaluate(() => {
          const root = globalThis.__CreatePage('page', 0);
          const view = globalThis.__CreateView(0);
          globalThis.__SetID(view, 'test-view');
          globalThis.__SetInlineStyles(view, {
            'background-image': 'url(icon-2rpx.png) 10rpx 20rpx',
            'background-size': 'sprite-3RPX-large 50rpx',
            'content': 'counter(section-4rpx)',
            'font-family': 'font-5rpx-bold, Arial',
          });
          globalThis.__AppendElement(root, view);
          globalThis.__FlushElementTree();
        });

        const viewElement = page.locator('#test-view');
        const style = await viewElement.getAttribute('style');

        // Identifiers with rpx should remain unchanged
        expect(style).toContain('icon-2rpx.png');
        expect(style).toContain('sprite-3RPX-large');
        expect(style).toContain('section-4rpx');
        expect(style).toContain('font-5rpx-bold');

        // Only actual rpx units should be transformed
        expect(style).toContain('calc(10 * var(--rpx))');
        expect(style).toContain('calc(20 * var(--rpx))');
        expect(style).toContain('calc(50 * var(--rpx))');

        // Should not contain calc for identifier parts
        expect(style).not.toContain('calc(icon-2rpx');
        expect(style).not.toContain('calc(sprite-3RPX');
        expect(style).not.toContain('calc(section-4rpx');
        expect(style).not.toContain('calc(font-5rpx');
      });
    });

    test.describe('rpx with existing CSS transformations', () => {
      test('rpx with flex properties', async ({ page }) => {
        await page.evaluate(() => {
          const root = globalThis.__CreatePage('page', 0);
          const view = globalThis.__CreateView(0);
          globalThis.__SetID(view, 'test-view');
          globalThis.__SetInlineStyles(view, {
            'flex-basis': '100rpx',
            'flex-grow': '1',
            'flex-shrink': '0',
          });
          globalThis.__AppendElement(root, view);
          globalThis.__FlushElementTree();
        });

        const viewElement = page.locator('#test-view');
        const style = await viewElement.getAttribute('style');
        expect(style).toContain('--flex-basis');
        expect(style).toContain('calc(100 * var(--rpx))');
        expect(style).toContain('--flex-grow:1');
        expect(style).toContain('--flex-shrink:0');
      });

      test('rpx with color gradient', async ({ page }) => {
        await page.evaluate(() => {
          const root = globalThis.__CreatePage('page', 0);
          const view = globalThis.__CreateView(0);
          globalThis.__SetID(view, 'test-view');
          globalThis.__SetInlineStyles(
            view,
            'color: linear-gradient(to right, red 10rpx, blue)',
          );
          globalThis.__AppendElement(root, view);
          globalThis.__FlushElementTree();
        });

        const viewElement = page.locator('#test-view');
        const style = await viewElement.getAttribute('style');
        expect(style).toContain('color:transparent');
        expect(style).toContain('-webkit-background-clip:text');
        expect(style).toContain(
          '--lynx-text-bg-color:linear-gradient(to right, red calc(10 * var(--rpx)), blue)',
        );
      });

      test('rpx with linear-weight properties', async ({ page }) => {
        await page.evaluate(() => {
          const root = globalThis.__CreatePage('page', 0);
          const view = globalThis.__CreateView(0);
          globalThis.__SetID(view, 'test-view');
          globalThis.__SetInlineStyles(view, {
            'linear-weight': '2',
            'width': '100rpx',
          });
          globalThis.__AppendElement(root, view);
          globalThis.__FlushElementTree();
        });

        const viewElement = page.locator('#test-view');
        const style = await viewElement.getAttribute('style');
        expect(style).toContain('--lynx-linear-weight:2');
        expect(style).toContain('--lynx-linear-weight-basis:0');
        expect(style).toContain('calc(100 * var(--rpx))');
      });
    });

    test.describe('different rpx scale factors', () => {
      test('rpx with different scale factor', async ({ page }) => {
        // Change the rpx scale factor
        await page.evaluate(() => {
          const style = document.querySelector('style');
          style.textContent = ':root { --rpx: 2px; }';
        });

        await page.evaluate(() => {
          const root = globalThis.__CreatePage('page', 0);
          const view = globalThis.__CreateView(0);
          globalThis.__SetID(view, 'test-view');
          globalThis.__AddInlineStyle(view, 'width', '100rpx');
          globalThis.__AppendElement(root, view);
          globalThis.__FlushElementTree();
        });

        const viewElement = page.locator('#test-view');
        const style = await viewElement.getAttribute('style');
        expect(style).toContain('calc(100 * var(--rpx))');
        await expect(viewElement).toHaveCSS('width', '200px');
      });

      test('rpx with fractional scale factor', async ({ page }) => {
        // Change the rpx scale factor to 0.5px
        await page.evaluate(() => {
          const style = document.querySelector('style');
          style.textContent = ':root { --rpx: 0.5px; }';
        });

        await page.evaluate(() => {
          const root = globalThis.__CreatePage('page', 0);
          const view = globalThis.__CreateView(0);
          globalThis.__SetID(view, 'test-view');
          globalThis.__AddInlineStyle(view, 'width', '100rpx');
          globalThis.__AppendElement(root, view);
          globalThis.__FlushElementTree();
        });

        const viewElement = page.locator('#test-view');
        const style = await viewElement.getAttribute('style');
        expect(style).toContain('calc(100 * var(--rpx))');
        await expect(viewElement).toHaveCSS('width', '50px');
      });
    });

    test.describe('complex rpx scenarios', () => {
      test('complex layout with multiple rpx values', async ({ page }) => {
        await page.evaluate(() => {
          const root = globalThis.__CreatePage('page', 0);

          // Container
          const container = globalThis.__CreateView(0);
          globalThis.__SetID(container, 'container');
          globalThis.__SetInlineStyles(container, {
            'width': '750rpx',
            'height': '400rpx',
            'padding': '10rpx 20rpx',
            'margin': '15rpx auto',
            'display': 'flex',
          });

          // Child 1
          const child1 = globalThis.__CreateView(0);
          globalThis.__SetID(child1, 'child1');
          globalThis.__SetInlineStyles(child1, {
            'width': '200rpx',
            'height': '100rpx',
            'margin-right': '10rpx',
            'flex-basis': '200rpx',
          });

          // Child 2
          const child2 = globalThis.__CreateView(0);
          globalThis.__SetID(child2, 'child2');
          globalThis.__SetInlineStyles(child2, {
            'flex': '1',
            'min-width': '100rpx',
            'max-width': '500rpx',
            'padding': '5rpx',
          });

          globalThis.__AppendElement(root, container);
          globalThis.__AppendElement(container, child1);
          globalThis.__AppendElement(container, child2);
          globalThis.__FlushElementTree();
        });

        // Verify container
        const container = page.locator('#container');
        const containerStyle = await container.getAttribute('style');
        expect(containerStyle).toContain('calc(750 * var(--rpx))');
        expect(containerStyle).toContain('calc(400 * var(--rpx))');
        expect(containerStyle).toContain(
          'calc(10 * var(--rpx)) calc(20 * var(--rpx))',
        );
        expect(containerStyle).toContain('calc(15 * var(--rpx)) auto');

        // Verify child1
        const child1 = page.locator('#child1');
        const child1Style = await child1.getAttribute('style');
        expect(child1Style).toContain('calc(200 * var(--rpx))');
        expect(child1Style).toContain('calc(100 * var(--rpx))');
        expect(child1Style).toContain('calc(10 * var(--rpx))');
        expect(child1Style).toContain('--flex-basis');

        // Verify child2
        const child2 = page.locator('#child2');
        const child2Style = await child2.getAttribute('style');
        expect(child2Style).toContain('--flex-grow:1');
        expect(child2Style).toContain('calc(100 * var(--rpx))');
        expect(child2Style).toContain('calc(500 * var(--rpx))');
        expect(child2Style).toContain('calc(5 * var(--rpx))');

        // Verify computed CSS values
        await expect(container).toHaveCSS('width', '750px');
        await expect(container).toHaveCSS('height', '400px');
        await expect(child1).toHaveCSS('width', '200px');
        await expect(child1).toHaveCSS('height', '100px');
      });

      test('rpx with responsive behavior', async ({ page }) => {
        // Test different viewport sizes
        await page.setViewportSize({ width: 375, height: 667 });

        // Set rpx to be responsive (e.g., 1rpx = 1.5px on smaller screens)
        await page.evaluate(() => {
          const style = document.querySelector('style');
          style.textContent = ':root { --rpx: 1.5px; }';
        });

        await page.evaluate(() => {
          const root = globalThis.__CreatePage('page', 0);
          const view = globalThis.__CreateView(0);
          globalThis.__SetID(view, 'responsive-view');
          globalThis.__SetInlineStyles(view, {
            'width': '750rpx', // Should be 1125px (1.5 * 750)
            'height': '200rpx', // Should be 300px
            'font-size': '32rpx', // Should be 48px
          });
          globalThis.__AppendElement(root, view);
          globalThis.__FlushElementTree();
        });

        const view = page.locator('#responsive-view');
        const style = await view.getAttribute('style');
        expect(style).toContain('calc(750 * var(--rpx))');
        expect(style).toContain('calc(200 * var(--rpx))');
        expect(style).toContain('calc(32 * var(--rpx))');

        await expect(view).toHaveCSS('width', '1125px');
        await expect(view).toHaveCSS('height', '300px');
        await expect(view).toHaveCSS('font-size', '48px');
      });
    });
  });
});
