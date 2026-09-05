import './jsdom.js';
import { rs } from '@rstest/core';

import { describeBench } from './benchRunner.js';
import { createElementAPI } from '../ts/client/mainthread/elementAPIs/createElementAPI.js';
import { WASMJSBinding } from '../ts/client/mainthread/elementAPIs/WASMJSBinding.js';

describeBench('Element APIs Benchmarks', (bench) => {
  let lynxViewDom: HTMLElement;
  let rootDom: ShadowRoot;
  let mtsGlobalThis: ReturnType<typeof createElementAPI>;
  let mtsBinding: WASMJSBinding;

  const setup = () => {
    rs.resetAllMocks();
    lynxViewDom = document.createElement('div') as unknown as HTMLElement;
    rootDom = lynxViewDom.attachShadow({ mode: 'open' });

    mtsBinding = new WASMJSBinding(
      rs.mockObject({
        rootDom,
        backgroundThread: rs.mockObject({
          publicComponentEvent: rs.fn(),
          publishEvent: rs.fn(),
          postTimingFlags: rs.fn(),
          markTiming: rs.fn(),
          flushTimingInfo: rs.fn(),
          jsContext: rs.mockObject({
            dispatchEvent: rs.fn(),
          }),
        } as any),
        exposureServices: rs.mockObject({
          updateExposureStatus: rs.fn(),
        }) as any,
        mainThreadGlobalThis: rs.mockObject({}) as any,
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

  // Style Transformation E2E
  {
    let view: any;
    const viewSetup = () => {
      view = mtsGlobalThis.__CreateView(0);
    };
    viewSetup();

    // 1. Benchmark: Complex Inline Style String (with rpx transformation)
    // This simulates a typical "heavy" style string that needs tokenization and unit conversion.
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
    bench(
      'Style Transformation E2E > __SetInlineStyles (Complex String with rpx)',
      () => {
        mtsGlobalThis.__SetInlineStyles(view, COMPLEX_STYLE_STRING);
      },
    );

    // 2. Benchmark: Large Style Payload (Many properties)
    // This tests throughput for large strings.
    const LARGE_STYLE_STRING = Array.from({ length: 100 })
      .map((_, i) => `--custom-prop-${i}: ${i}rpx;`)
      .join(' ');

    bench(
      'Style Transformation E2E > __SetInlineStyles (Large Payload - 100 props)',
      () => {
        mtsGlobalThis.__SetInlineStyles(view, LARGE_STYLE_STRING);
      },
    );

    // 3. Benchmark: Key-Value Object (No string parsing, but map transformation)
    // This tests the overhead when styles are passed as an object.
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
    bench(
      'Style Transformation E2E > __SetInlineStyles (Object Payload)',
      () => {
        mtsGlobalThis.__SetInlineStyles(view, STYLE_OBJECT);
      },
    );

    // 4. Benchmark: Single Property Addition via __AddInlineStyle
    // Tests the overhead of modifying a single property, which might trigger re-parsing or lighter logic.
    bench(
      'Style Transformation E2E > __AddInlineStyle (Single rpx Property)',
      () => {
        mtsGlobalThis.__AddInlineStyle(view, 'width', '375rpx');
      },
    );

    // 5. Benchmark: Single Property Addition via __AddInlineStyle with ID (enum optimization)
    // Assuming 26 is a valid CSS Property ID (checked from earlier existing tests)
    bench(
      'Style Transformation E2E > __AddInlineStyle (Single ID Property)',
      () => {
        mtsGlobalThis.__AddInlineStyle(view, 26, '100px');
      },
    );
  }
});
