/* eslint-disable headers/header-format */
import type { LynxTemplate, StyleInfo } from '@lynx-js/web-constants';

import { processCSS } from './css-processor.js';
import { getConsoleWrapperCode } from '../console/console-wrapper.js';

// Injects callDestroyLifetimeFun into lynxCoreInject.tt so that lynx-core can
// register it on multiApps[id] and invoke it safely during card dispose.
// Mirrors what ReactLynx does in packages/react/runtime/src/lynx/tt.ts,
// but without the React/worklet-specific teardown — for raw Element PAPI cards
// the only meaningful cleanup is neutralizing stale event handlers.
function getBackgroundLifecycleCode(): string {
  return `(function(){
  if (typeof lynxCoreInject !== 'undefined' && lynxCoreInject.tt) {
    lynxCoreInject.tt.callDestroyLifetimeFun = function() {
      lynxCoreInject.tt.publishEvent = function() {};
      lynxCoreInject.tt.publicComponentEvent = function() {};
    };
  }
})();
`;
}

export function buildLynxTemplate(
  mainThread: string,
  background: string,
  css: string,
  sessionId: string,
): {
  template: LynxTemplate;
  timing: { 'css-serializer': number | null; assemble: number };
} {
  const mainThreadWithFallback = `${mainThread}

if (typeof globalThis.renderPage !== 'function') {
  globalThis.renderPage = () => {};
}
`;

  const mainThreadCode = getConsoleWrapperCode('main-thread', sessionId)
    + mainThreadWithFallback;
  const backgroundCode = getConsoleWrapperCode('background', sessionId)
    + getBackgroundLifecycleCode()
    + background;

  let styleInfo: StyleInfo = {};
  let cssSerializerTime: number | null = null;
  if (css.trim()) {
    const t = performance.now();
    styleInfo = processCSS(css);
    cssSerializerTime = performance.now() - t;
  }

  const assembleStart = performance.now();
  const template: LynxTemplate = {
    lepusCode: { root: mainThreadCode },
    manifest: { '/app-service.js': backgroundCode },
    styleInfo,
    pageConfig: {
      enableCSSSelector: true,
      enableRemoveCSSScope: true,
      defaultDisplayLinear: true,
      defaultOverflowVisible: true,
      enableJSDataProcessor: false,
    },
    customSections: {},
    elementTemplate: {},
    appType: 'card',
  };
  const assembleTime = performance.now() - assembleStart;

  return {
    template,
    timing: { 'css-serializer': cssSerializerTime, assemble: assembleTime },
  };
}
