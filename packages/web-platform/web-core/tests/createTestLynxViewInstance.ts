import { rstest } from '@rstest/core';

import type { WASMJSBindingInjectedHandler } from '../ts/client/mainthread/elementAPIs/WASMJSBinding.js';

export function createTestLynxViewInstance(
  rootDom: ShadowRoot,
  mainThreadGlobalThis = {} as WASMJSBindingInjectedHandler[
    'mainThreadGlobalThis'
  ],
): WASMJSBindingInjectedHandler {
  return {
    rootDom,
    backgroundThread: {
      publicComponentEvent: rstest.fn(),
      publishEvent: rstest.fn(),
      postTimingFlags: rstest.fn(),
      markTiming: rstest.fn(),
      flushTimingInfo: rstest.fn(),
      jsContext: {
        dispatchEvent: rstest.fn(),
      },
    } as WASMJSBindingInjectedHandler['backgroundThread'],
    exposureServices: {
      updateExposureStatus: rstest.fn(),
    } as WASMJSBindingInjectedHandler['exposureServices'],
    mainThreadGlobalThis,
    invokeUIMethod: rstest.fn(),
    lynxViewClientLeft: 0,
    lynxViewClientTop: 0,
  };
}
