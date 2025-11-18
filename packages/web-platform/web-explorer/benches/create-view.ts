import { Bench } from 'tinybench';
import { createMainThreadGlobalThis } from '@lynx-js/web-mainthread-apis/dist/index.js';
import {
  createMtsGlobalThis,
  templateManager,
} from '@lynx-js/web-core-wasm/ts/createMtsGlobalThis.ts';

const bench = new Bench({ time: 20 });
console.log(templateManager);
const lynxView = document.createElement('lynx-view');
const rootDom = lynxView.attachShadow({ mode: 'open' });

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
  rootDom,
  jsContext: {},
  mtsRealm: {
    globalWindow: window,
  },
  document: document,
} as any);

const mtsGlobalThisWasm = createMtsGlobalThis(
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

bench
  // .add('create-view-wasm', () => {
  //   mtsGlobalThisWasm.__CreateView(1);
  // })
  // .add('create-view-js', () => {
  //   mtsGlobalThisJS.__CreateView(1);
  // })
  // .add('set-inline-style-obj-wasm', () => {
  //   const element = mtsGlobalThisWasm.__CreateView(1);
  //   mtsGlobalThisWasm.__SetInlineStyles(element, {
  //     width: '100px',
  //     height: '100px',
  //     backgroundColor: 'red',
  //   });
  // })
  // .add('set-inline-style-obj-js', () => {
  //   const element = mtsGlobalThisJS.__CreateView(1);
  //   mtsGlobalThisJS.__SetInlineStyles(element, {
  //     width: '100px',
  //     height: '100px',
  //     backgroundColor: 'red',
  //   });
  // })
  // .add('set-inline-style-str-wasm', () => {
  //   const element = mtsGlobalThisWasm.__CreateView(1);
  //   mtsGlobalThisWasm.__SetInlineStyles(element, "width: 100px; height: 100px; background-color: red;");
  // })
  // .add('set-inline-style-str-js', () => {
  //   const element = mtsGlobalThisJS.__CreateView(1);
  //   mtsGlobalThisJS.__SetInlineStyles(element, "width: 100px; height: 100px; background-color: red;");
  // })
  .add('add-inline-style-wasm-str', () => {
    const element = mtsGlobalThisWasm.__CreateView(1);
    mtsGlobalThisWasm.__AddInlineStyle(element, 'width', '100px');
  })
  .add('add-inline-style-js-str', () => {
    const element = mtsGlobalThisJS.__CreateView(1);
    mtsGlobalThisJS.__AddInlineStyle(element, 'width', '100px');
  })
  .add('add-inline-style-wasm-num', () => {
    const element = mtsGlobalThisWasm.__CreateView(1);
    mtsGlobalThisWasm.__AddInlineStyle(element, 1, '100px');
  })
  .add('add-inline-style-js-num', () => {
    const element = mtsGlobalThisJS.__CreateView(1);
    mtsGlobalThisJS.__AddInlineStyle(element, 1, '100px');
  });

// .add('create-text-wasm', () => {
//   mtsGlobalThisWasm.__CreateText(1);
// })
// .add('create-text-js', () => {
//   mtsGlobalThisJS.__CreateText(1);
// })
// .add('create-raw-text-wasm', () => {
//   mtsGlobalThisWasm.__CreateRawText('hello');
// })
// .add('create-raw-text-js', () => {
//   mtsGlobalThisJS.__CreateRawText('hello');
// })
// .add('create-scroll-view-wasm', () => {
//   mtsGlobalThisWasm.__CreateScrollView(1);
// })
// .add('create-scroll-view-js', () => {
//   mtsGlobalThisJS.__CreateScrollView(1);
// })
// .add('create-component-wasm', () => {
//   mtsGlobalThisWasm.__CreateComponent(
//     0,
//     'comp_2',
//     0,
//     'entryName',
//     'name',
//     'path',
//     {},
//     {},
//   );
// })
// .add('create-component-js', () => {
//   mtsGlobalThisJS.__CreateComponent(
//     0,
//     'comp_1',
//     0,
//     'entryName',
//     'name',
//     'path',
//     {},
//     {},
//   );
// })
// .add('create-list-wasm', () => {
//   mtsGlobalThisWasm.__CreateList(
//     1,
//     () => null,
//     () => {},
//   );
// })
// .add('create-list-js', () => {
//   mtsGlobalThisJS.__CreateList(
//     1,
//     () => null,
//     () => {},
//   );
// })
// .add('create-page-wasm', () => {
//   mtsGlobalThisWasm.__CreatePage('page_2', 0, null);
// })
// .add('create-page-js', () => {
//   mtsGlobalThisJS.__CreatePage('page_1', 0, null);
// });

// const elementJS = mtsGlobalThisJS.__CreateView(1);
// const elementWasm = mtsGlobalThisWasm.__CreateView(1);
// const listElementJS = mtsGlobalThisJS.__CreateList(
//   1,
//   () => null,
//   () => {},
// );
// const listElementWasm = mtsGlobalThisWasm.__CreateList(
//   1,
//   () => null,
//   () => {},
// );

// // bench
// //   .add('set-attribute-remove-js', () => {
// //     mtsGlobalThisJS.__SetAttribute(
// //       elementJS,
// //       'test-attribute',
// //       null,
// //     );
// //   })
// //   .add('set-attribute-remove-wasm', () => {
// //     mtsGlobalThisWasm.__SetAttribute(
// //       elementWasm,
// //       'test-attribute',
// //       null,
// //     );
// //   })
// //   .add('set-attribute-js', () => {
// //     mtsGlobalThisJS.__SetAttribute(
// //       elementJS,
// //       'test-attribute',
// //       'test-value',
// //     );
// //   })
// //   .add('set-attribute-wasm', () => {
// //     mtsGlobalThisWasm.__SetAttribute(
// //       elementWasm,
// //       'test-attribute',
// //       'test-value',
// //     );
// //   })
// //   .add('set-attribute-exposure-js', () => {
// //     mtsGlobalThisJS.__SetAttribute(
// //       elementJS,
// //       'exposure-id',
// //       'exposure-123',
// //     );
// //   })
// //   .add('set-attribute-exposure-wasm', () => {
// //     mtsGlobalThisWasm.__SetAttribute(
// //       elementWasm,
// //       'exposure-id',
// //       'exposure-123',
// //     );
// //   })
// //   .add('set-attribute-exposure-remove-js', () => {
// //     mtsGlobalThisJS.__SetAttribute(
// //       elementJS,
// //       'exposure-id',
// //       null,
// //     );
// //   })
// //   .add('set-attribute-exposure-remove-wasm', () => {
// //     mtsGlobalThisWasm.__SetAttribute(
// //       elementWasm,
// //       'exposure-id',
// //       null,
// //     );
// //   })
// //   .add('set-attribute-timing-flag-js', () => {
// //     mtsGlobalThisJS.__SetAttribute(
// //       elementJS,
// //       '__lynx_timing_flag',
// //       'flag-1',
// //     );
// //   })
// //   .add('set-attribute-timing-flag-wasm', () => {
// //     mtsGlobalThisWasm.__SetAttribute(
// //       elementWasm,
// //       '__lynx_timing_flag',
// //       'flag-1',
// //     );
// //   })
// //   .add('set-list-info-js', () => {
// //     mtsGlobalThisJS.__SetAttribute(
// //       listElementJS,
// //       'update-list-info',
// //       {
// //         insertAction: [{ position: 0 }],
// //         removeAction: [{ position: 1 }],
// //       },
// //     );
// //   })
// //   .add('set-list-info-wasm', () => {
// //     mtsGlobalThisWasm.__SetAttribute(
// //       listElementWasm,
// //       'update-list-info',
// //       {
// //         insertAction: [{ position: 0 }],
// //         removeAction: [{ position: 1 }],
// //       } as any,
// //     );
// //   });

await bench.run();

console.table(bench.table());

const resultsElement = document.createElement('pre');
resultsElement.textContent = JSON.stringify(
  bench.table().map(r => ({
    ...r,
    'Throughput avg (ops/s)': r['Throughput avg (ops/s)'],
  })),
  null,
  2,
);
document.body.appendChild(resultsElement);
