import { bench, describe } from 'vitest';
// @ts-expect-error
// import { SSR, loadTemplate } from '../server.js';
import { Window } from 'happy-dom';
import { createMainThreadGlobalThis } from '@lynx-js/web-mainthread-apis/ts/createMainThreadGlobalThis.js';
import { createMainThreadGlobalThis as createMainThreadGlobalThisWasm } from '@lynx-js/web-mainthread-apis/dist/MainThreadGlobalThis.js';
// const cases = {
//   'basic-performance-div-10000': await loadTemplate(
//     'basic-performance-div-10000',
//   ),
//   'basic-performance-div-1000': await loadTemplate(
//     'basic-performance-div-1000',
//   ),
//   'basic-performance-div-100': await loadTemplate('basic-performance-div-100'),
//   'basic-performance-nest-level-100': await loadTemplate(
//     'basic-performance-nest-level-100',
//   ),
//   'basic-performance-image-100': await loadTemplate(
//     'basic-performance-image-100',
//   ),
//   'basic-performance-scroll-view-100': await loadTemplate(
//     'basic-performance-scroll-view-100',
//   ),
//   'basic-performance-text-200': await loadTemplate(
//     'basic-performance-text-200',
//   ),
//   'basic-performance-large-css': await loadTemplate(
//     'basic-performance-large-css',
//   ),
//   'basic-performance-small-css': await loadTemplate(
//     'basic-performance-small-css',
//   ),
// };
// describe('server-tests', async () => {
// for (const [testName, rawTemplate] of Object.entries(cases)) {
//   bench(testName, async () => {
//     const html = await SSR(rawTemplate, testName);
//   });
// }
// });

const window = new Window();
// Object.assign(globalThis, window);
const lynxView = window.document.createElement('lynx-view');
const shadowroot = lynxView.attachShadow({ mode: 'open' });
// @ts-expect-error
globalThis.requestAnimationFrame = window.requestAnimationFrame.bind(window);
// @ts-expect-error
globalThis.cancelAnimationFrame = window.cancelAnimationFrame.bind(window);

const tagMap = { 'view': 'x-view', 'page': 'div' };
const mtsGlobalThisJS = createMainThreadGlobalThis({
  pageConfig: {
    enableCSSSelector: true,
    enableRemoveCSSScope: true,
    defaultDisplayLinear: true,
    defaultOverflowVisible: false,
    enableJSDataProcessor: true,
  },
  globalProps: {},
  callbacks: {
    flushElementTree: () => {},
  },
  lynxTemplate: {},
  browserConfig: {},
  tagMap,
  rootDom: shadowroot,
  jsContext: {},
  mtsRealm: {
    globalWindow: window,
  },
  document: window.document,
} as any);

const mtsGlobalThisWasm = createMainThreadGlobalThisWasm(
  tagMap,
  window.document,
  window.document.body,
  true,
  true,
  true,
  false,
  true,
  {},
  {},
  {},
  {},
  {},
  {},
  () => {},
  () => {},
  () => {},
  () => {},
  () => {},
  () => {},
);

describe('create-view', async () => {
  bench('create-view-js', () => {
    mtsGlobalThisJS.__CreateView(1);
  }, { throws: true });

  bench('create-view-wasm', () => {
    mtsGlobalThisWasm.__CreateView(1);
  }, { throws: true });
});

describe('create-page', () => {
  bench('create-page-js', () => {
    mtsGlobalThisJS.__CreatePage('page_1', 1, null);
  }, { throws: true });

  bench('create-page-wasm', () => {
    // @ts-expect-error
    mtsGlobalThisWasm.__CreatePage('page_2', 1, null);
  }, { throws: true });
});

describe('create_component', () => {
  bench('create-component-js', () => {
    mtsGlobalThisJS.__CreateComponent(
      0,
      'comp_1',
      1,
      'entryName',
      'name',
      'path',
      {},
      {},
    );
  }, { throws: true });

  bench('create-component-wasm', () => {
    mtsGlobalThisWasm.__CreateComponent(
      0,
      'comp_2',
      1,
      'entryName',
      'name',
      'path',
      {},
      {},
    );
  }, { throws: true });
});

describe('create_list', () => {
  bench('create-list-js', () => {
    mtsGlobalThisJS.__CreateList(
      1,
      () => null,
      () => {},
    );
  }, { throws: true });

  bench('create-list-wasm', () => {
    mtsGlobalThisWasm.__CreateList(
      1,
      () => null,
      () => {},
    );
  }, { throws: true });
});

describe('set_attribute', () => {
  const elementJS = mtsGlobalThisJS.__CreateView(1);
  const elementWasm = mtsGlobalThisWasm.__CreateView(1);
  const listElementJS = mtsGlobalThisJS.__CreateList(
    1,
    () => null,
    () => {},
  );
  const listElementWasm = mtsGlobalThisWasm.__CreateList(
    1,
    () => null,
    () => {},
  );

  bench('set-attribute-remove-js', () => {
    mtsGlobalThisJS.__SetAttribute(
      elementJS,
      'test-attribute',
      null,
    );
  }, { throws: true });

  bench('set-attribute-remove-wasm', () => {
    mtsGlobalThisWasm.__SetAttribute(
      elementWasm,
      'test-attribute',
      null,
    );
  }, { throws: true });

  bench('set-attribute-js', () => {
    mtsGlobalThisJS.__SetAttribute(
      elementJS,
      'test-attribute',
      'test-value',
    );
  }, { throws: true });

  bench('set-attribute-wasm', () => {
    mtsGlobalThisWasm.__SetAttribute(
      elementWasm,
      'test-attribute',
      'test-value',
    );
  }, { throws: true });

  bench('set-attribute-exposure-js', () => {
    mtsGlobalThisJS.__SetAttribute(
      elementJS,
      'exposure-id',
      'exposure-123',
    );
  }, { throws: true });

  bench('set-attribute-exposure-wasm', () => {
    mtsGlobalThisWasm.__SetAttribute(
      elementWasm,
      'exposure-id',
      'exposure-123',
    );
  }, { throws: true });

  bench('set-attribute-exposure-remove-js', () => {
    mtsGlobalThisJS.__SetAttribute(
      elementJS,
      'exposure-id',
      null,
    );
  }, { throws: true });

  bench('set-attribute-exposure-remove-wasm', () => {
    mtsGlobalThisWasm.__SetAttribute(
      elementWasm,
      'exposure-id',
      null,
    );
  }, { throws: true });

  bench('set-attribute-timing-flag-js', () => {
    mtsGlobalThisJS.__SetAttribute(
      elementJS,
      '__lynx_timing_flag',
      'flag-1',
    );
  }, { throws: true });

  bench('set-attribute-timing-flag-wasm', () => {
    mtsGlobalThisWasm.__SetAttribute(
      elementWasm,
      '__lynx_timing_flag',
      'flag-1',
    );
  }, { throws: true });

  bench('set-list-info-js', () => {
    mtsGlobalThisJS.__SetAttribute(
      listElementJS,
      'update-list-info',
      {
        insertAction: [{ position: 0 }],
        removeAction: [{ position: 1 }],
      },
    );
  }, { throws: true });

  bench('set-list-info-wasm', () => {
    mtsGlobalThisWasm.__SetAttribute(
      listElementWasm,
      'update-list-info',
      {
        insertAction: [{ position: 0 }],
        removeAction: [{ position: 1 }],
      } as any,
    );
  }, { throws: true });
});

describe('swap_element', () => {
  const elementParentAJS = mtsGlobalThisJS.__CreateView(1);
  const elementParentAWasm = mtsGlobalThisWasm.__CreateView(1);
  const elementParentBJS = mtsGlobalThisJS.__CreateView(1);
  const elementParentBWasm = mtsGlobalThisWasm.__CreateView(1);
  const elementAJS = mtsGlobalThisJS.__CreateView(1);
  const elementBJS = mtsGlobalThisJS.__CreateView(1);
  const elementAWasm = mtsGlobalThisWasm.__CreateView(1);
  const elementBWasm = mtsGlobalThisWasm.__CreateView(1);
  elementParentAJS.appendChild(elementAJS);
  elementParentBJS.appendChild(elementBJS);
  elementParentAWasm.appendChild(elementAWasm);
  elementParentBWasm.appendChild(elementBWasm);

  bench('swap-element-js', () => {
    mtsGlobalThisJS.__SwapElement(
      elementAJS,
      elementBJS,
    );
  }, { throws: true });

  bench('swap-element-wasm', () => {
    mtsGlobalThisWasm.__SwapElement(
      elementAWasm,
      elementBWasm,
    );
  }, { throws: true });
});

describe('get-page-element', () => {
  mtsGlobalThisJS.__CreatePage('page_1', 1, null);
  mtsGlobalThisWasm.__CreatePage('page_2', 1, null);
  bench('get-page-element-js', () => {
    mtsGlobalThisJS.__GetPageElement();
  }, { throws: true });

  bench('get-page-element-wasm', () => {
    mtsGlobalThisWasm.__GetPageElement();
  }, { throws: true });
});

describe.skip('flush-element-tree', () => {
  let js_page = mtsGlobalThisJS.__CreatePage('page_1', 1, null);
  let js_view = mtsGlobalThisJS.__CreateView(1);
  js_page.appendChild(js_view);
  mtsGlobalThisJS.__SetAttribute(
    js_view,
    'exposure-id',
    'exposure-123',
  );
  mtsGlobalThisJS.__SetAttribute(
    js_view,
    '__lynx_timing_flag',
    'flag-1',
  );

  let wasm_page = mtsGlobalThisWasm.__CreatePage('page_2', 1, null);
  let wasm_view = mtsGlobalThisWasm.__CreateView(1);
  wasm_page.appendChild(wasm_view);
  mtsGlobalThisWasm.__SetAttribute(
    wasm_view,
    'exposure-id',
    'exposure-123',
  );
  mtsGlobalThisWasm.__SetAttribute(
    wasm_view,
    '__lynx_timing_flag',
    'flag-1',
  );
  bench('flush-element-tree-js', () => {
    mtsGlobalThisJS.__FlushElementTree(
      null,
      {},
    );
  }, { throws: true });

  bench('flush-element-tree-wasm', () => {
    mtsGlobalThisWasm.__FlushElementTree(
      null,
      {},
    );
  }, { throws: true });
});
