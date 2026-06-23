// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import './jsdom.js';
import { Bench, withCodSpeed } from '@lynx-js/codspeed-tinybench';
import { createElementAPI } from '../ts/client/mainthread/elementAPIs/createElementAPI.js';
import { WASMJSBinding } from '../ts/client/mainthread/elementAPIs/WASMJSBinding.js';

// `jsdom.js` replaces `globalThis.Event`/`MouseEvent` with jsdom's versions
// (the rstest tests rely on that). tinybench's `Bench`, however, is a native
// `EventTarget` and dispatches native `Event`s, which jsdom's `Event` is not.
// Restore the natives stashed by `jsdom.js` before constructing the `Bench`.
globalThis.Event = (globalThis as any).__nativeEvent__;
globalThis.MouseEvent = (globalThis as any).__nativeMouseEvent__;

const mockApi: { mockObject: (o: object) => any; fn: () => any } =
  (globalThis as any).rstest ?? (globalThis as any).vi ?? {
    mockObject: (o: object) => o,
    fn: () => ({ mockReturnValue: () => {} }),
  };

const bench = new Bench();

let lynxViewDom: HTMLElement;
let rootDom: ShadowRoot;
let mtsGlobalThis: ReturnType<typeof createElementAPI>;
let mtsBinding: WASMJSBinding;

const setup = () => {
  lynxViewDom = document.createElement('div') as unknown as HTMLElement;
  rootDom = lynxViewDom.attachShadow({ mode: 'open' });

  mtsBinding = new WASMJSBinding(
    mockApi.mockObject({
      rootDom,
      backgroundThread: mockApi.mockObject({
        publicComponentEvent: mockApi.fn(),
        publishEvent: mockApi.fn(),
        postTimingFlags: mockApi.fn(),
        markTiming: mockApi.fn(),
        flushTimingInfo: mockApi.fn(),
        jsContext: mockApi.mockObject({
          dispatchEvent: mockApi.fn(),
        }),
      } as any),
      exposureServices: mockApi.mockObject({
        updateExposureStatus: mockApi.fn(),
      }) as any,
      mainThreadGlobalThis: mockApi.mockObject({}) as any,
    }),
  );
  mtsGlobalThis = createElementAPI(
    rootDom,
    mtsBinding,
    true,
    true,
    true,
  );
};

setup();

const view: any = mtsGlobalThis.__CreateView(0);

// 1. Benchmark: Complex Inline Style String (with rpx transformation)
const COMPLEX_STYLE_STRING = `
            width: 750rpx;
            height: 100%;
            margin-top: 24rpx;
            margin-bottom: 24rpx;
            padding-left: 32rpx;
            padding-right: 32rpx;
            display: flex;
            flex-direction: column;
            justify-content: flex-start;
            align-items: center;
            background-color: #fafafa;
            border-radius: 16rpx;
            border-width: 2rpx;
            border-style: solid;
            border-color: rgba(0,0,0,0.1);
        `;
bench.add(
  'Style Transformation E2E > __SetInlineStyles (Complex String with rpx)',
  () => {
    mtsGlobalThis.__SetInlineStyles(view, COMPLEX_STYLE_STRING);
  },
);

// 2. Benchmark: Large Style Payload (Many properties)
const LARGE_STYLE_STRING = Array.from({ length: 100 })
  .map((_, i) => `--custom-prop-${i}: ${i}rpx;`)
  .join(' ');

bench.add(
  'Style Transformation E2E > __SetInlineStyles (Large Payload - 100 props)',
  () => {
    mtsGlobalThis.__SetInlineStyles(view, LARGE_STYLE_STRING);
  },
);

// 3. Benchmark: Key-Value Object (No string parsing, but map transformation)
const STYLE_OBJECT = {
  width: '750rpx',
  height: '100%',
  'margin-top': '24rpx',
  'margin-bottom': '24rpx',
  'padding-left': '32rpx',
  'padding-right': '32rpx',
  display: 'flex',
  'flex-direction': 'column',
  'justify-content': 'flex-start',
  'align-items': 'center',
  'background-color': '#fafafa',
  'border-radius': '16rpx',
  'border-width': '2rpx',
  'border-style': 'solid',
  'border-color': 'rgba(0,0,0,0.1)',
};
bench.add(
  'Style Transformation E2E > __SetInlineStyles (Object Payload)',
  () => {
    mtsGlobalThis.__SetInlineStyles(view, STYLE_OBJECT);
  },
);

// 4. Benchmark: Single Property Addition via __AddInlineStyle
bench.add(
  'Style Transformation E2E > __AddInlineStyle (Single rpx Property)',
  () => {
    mtsGlobalThis.__AddInlineStyle(view, 'width', '375rpx');
  },
);

// 5. Benchmark: Single Property Addition via __AddInlineStyle with ID
bench.add(
  'Style Transformation E2E > __AddInlineStyle (Single ID Property)',
  () => {
    mtsGlobalThis.__AddInlineStyle(view, 26, '100px');
  },
);

await withCodSpeed(bench, import.meta.url);
