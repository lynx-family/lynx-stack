import * as vm from 'vm';
import { decodeTemplate } from './decode.js';
import {
  createElementAPI,
  type SSRBinding,
} from './elementAPIs/createElementAPI.js';
import type { Cloneable, InitI18nResources } from '../types/index.js';
import { createServerLynx } from './createServerLynx.js';

export function executeTemplate(
  templateBuffer: Buffer,
  initData: Cloneable,
  globalProps: Cloneable,
  _initI18nResources: InitI18nResources,
  viewAttributes?: string,
): string | undefined {
  const result = decodeTemplate(templateBuffer);
  const config = result.config;

  const binding: SSRBinding = { ssrResult: '' };
  const { globalThisAPIs: elementAPIs } = createElementAPI(
    binding,
    result.styleInfo,
    viewAttributes ?? '',
    {
      enableCSSSelector: config['enableCSSSelector'] === 'true',
      defaultOverflowVisible: config['defaultOverflowVisible'] === 'true',
      defaultDisplayLinear: config['defaultDisplayLinear'] !== 'false', // Default to true if not present or 'true'
    },
  );

  const sandbox: Record<string, any> = {
    module: { exports: {} },
    exports: {},
    console: console,
    // Mock globals to match client environment if needed
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    lynx: createServerLynx(
      globalProps,
      result.customSections as unknown as Record<string, Cloneable>,
    ),
    __OnLifecycleEvent: () => {},
    ...elementAPIs,
  };

  const context = vm.createContext(sandbox);

  // Style Info block removed as it is passed to createElementAPI

  // Lepus Code
  const rootCodeBuf = result.lepusCode['root'];
  if (rootCodeBuf) {
    const rootCode = new TextDecoder('utf-8').decode(rootCodeBuf);
    const isLazy = config['isLazy'] === 'true';

    const wrappedCode = `
        (function() { 
          "use strict"; 
          const navigator = undefined;
          const postMessage = undefined;
          const window = undefined; 
          ${isLazy ? 'module.exports =' : ''} 
          ${rootCode}
        })()
      `;

    // Execute root code
    // This execution should trigger the assignment of globalThis.renderPage,
    // which in turn triggers our setter, queues the microtask.
    vm.runInContext(wrappedCode, context, {
      filename: `root`,
    });
    const renderPageFunction = sandbox['renderPage'];
    if (typeof renderPageFunction === 'function') {
      const processData = sandbox['processData'];
      const processedData = processData
        ? processData(initData)
        : initData;
      renderPageFunction(processedData);
      elementAPIs.__FlushElementTree();
      return binding.ssrResult;
    }
  }

  return undefined;
}
