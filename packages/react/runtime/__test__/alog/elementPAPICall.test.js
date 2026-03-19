import { describe, it, vi } from 'vitest';
import { initElementPAPICallAlog } from '../../src/alog/elementPAPICall';
import { globalEnvManager } from '../utils/envManager';
import { expect } from 'vitest';

describe('ElementPAPICall Alog', () => {
  it('should log ElementPAPICall as ALog', () => {
    globalEnvManager.switchToMainThread();
    console.alog = vi.fn();
    initElementPAPICallAlog();

    const page = __CreatePage('0', 0);
    __SetCSSId([page], 0);
    const text0 = __CreateText(0);
    const rawText0 = __CreateRawText('2', text0.$$uiSign);
    __AppendElement(text0, rawText0);
    __AppendElement(page, text0);
    __AddDataset(text0, 'testid', 'count-value');
    __OnLifecycleEvent(['rLynxFirstScreen', { 'root': '{}', 'jsReadyEventIdSwap': {} }]);

    expect(console.alog.mock.calls).toMatchInlineSnapshot(`
      [
        [
          "[ReactLynxDebug] FiberElement API call #1: __CreatePage("0", 0) => page#0",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #2: __SetCSSId([page#0], 0)",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #3: __CreateText(0) => text#1",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #4: __CreateRawText("2", 1) => raw-text#2",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #5: __AppendElement(text#1, raw-text#2)",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #6: __AppendElement(page#0, text#1)",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #7: __AddDataset(text#1, "testid", "count-value")",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #8: __OnLifecycleEvent(["rLynxFirstScreen", {"root":"{}","jsReadyEventIdSwap":{}}])",
        ],
      ]
    `);
  });
});
