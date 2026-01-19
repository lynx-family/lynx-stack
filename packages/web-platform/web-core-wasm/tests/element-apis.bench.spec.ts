import './jsdom.js';
import { bench, describe, vi } from 'vitest';
import { createElementAPI } from '../ts/client/mainthread/elementAPIs/createElementAPI.js';
import { WASMJSBinding } from '../ts/client/mainthread/elementAPIs/WASMJSBinding.js';

describe('Element APIs Benchmarks', () => {
  let lynxViewDom: HTMLElement;
  let rootDom: ShadowRoot;
  let mtsGlobalThis: ReturnType<typeof createElementAPI>;
  let mtsBinding: WASMJSBinding;

  const setup = () => {
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
        loadWebElement: vi.fn(),
        loadUnknownElement: vi.fn(),
        mainThreadGlobalThis: vi.mockObject({}) as any,
      }),
    );
    mtsGlobalThis = createElementAPI(
      'test',
      rootDom,
      mtsBinding,
      true,
      true,
      true,
    );
  };

  setup();

  describe('Style Transformation E2E', () => {
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
    bench('__SetInlineStyles (Complex String with rpx)', () => {
      mtsGlobalThis.__SetInlineStyles(view, COMPLEX_STYLE_STRING);
    });

    // 2. Benchmark: Large Style Payload (Many properties)
    // This tests throughput for large strings.
    const LARGE_STYLE_STRING = Array.from({ length: 100 })
      .map((_, i) => `--custom-prop-${i}: ${i}rpx;`)
      .join(' ');

    bench('__SetInlineStyles (Large Payload - 100 props)', () => {
      mtsGlobalThis.__SetInlineStyles(view, LARGE_STYLE_STRING);
    });

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
    bench('__SetInlineStyles (Object Payload)', () => {
      mtsGlobalThis.__SetInlineStyles(view, STYLE_OBJECT);
    });

    // 4. Benchmark: Single Property Addition via __AddInlineStyle
    // Tests the overhead of modifying a single property, which might trigger re-parsing or lighter logic.
    bench('__AddInlineStyle (Single rpx Property)', () => {
      mtsGlobalThis.__AddInlineStyle(view, 'width', '375rpx');
    });

    // 5. Benchmark: Single Property Addition via __AddInlineStyle with ID (enum optimization)
    // Assuming 26 is a valid CSS Property ID (checked from earlier existing tests)
    bench('__AddInlineStyle (Single ID Property)', () => {
      mtsGlobalThis.__AddInlineStyle(view, 26, '100px');
    });
  });
});
