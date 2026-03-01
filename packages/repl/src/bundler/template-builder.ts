import type { LynxTemplate, StyleInfo } from '@lynx-js/web-constants';

import { processCSS } from './css-processor.js';

export function buildLynxTemplate(
  mainThread: string,
  background: string,
  css: string,
): { template: LynxTemplate; timing: { 'css-serializer': number; assemble: number } } {
  const mainThreadWithFallback = `${mainThread}

if (typeof globalThis.renderPage !== 'function') {
  globalThis.renderPage = () => {};
}
`;

  let styleInfo: StyleInfo = {};
  let cssSerializerTime = 0;
  if (css.trim()) {
    const t = performance.now();
    styleInfo = processCSS(css);
    cssSerializerTime = performance.now() - t;
  }

  const assembleStart = performance.now();
  const template: LynxTemplate = {
    lepusCode: { root: mainThreadWithFallback },
    manifest: { '/app-service.js': background },
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

  return { template, timing: { 'css-serializer': cssSerializerTime, assemble: assembleTime } };
}
