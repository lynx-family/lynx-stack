/* eslint-disable headers/header-format */
import type { LynxTemplate, StyleInfo } from '@lynx-js/web-constants';

import { processCSS } from './css-processor.js';
import { getConsoleWrapperCode } from '../console/console-wrapper.js';

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
