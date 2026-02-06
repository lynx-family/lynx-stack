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
): Promise<string> {
  const result = decodeTemplate(templateBuffer);
  const config = result.config;

  const binding: SSRBinding = { ssrResult: '' };
  const elementAPIs = createElementAPI(
    binding,
    {
      enableCSSSelector: config['enableCSSSelector'] === 'true',
      defaultOverflowVisible: config['defaultOverflowVisible'] === 'true',
      defaultDisplayLinear: config['defaultDisplayLinear'] !== 'false', // Default to true if not present or 'true'
    },
    result.styleInfo,
  );

  let resolveRender: (val: string) => void;
  const renderPromise = new Promise<string>((resolve) => {
    resolveRender = resolve;
  });

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

  // Intercept renderPage assignment
  // When assigned, schedule a microtask to execute it.
  let renderPageFunction: ((data: Cloneable) => void) | null = null;
  Object.defineProperty(sandbox, 'renderPage', {
    get: () => {
      return renderPageFunction;
    },
    set: (v) => {
      renderPageFunction = v;
      if (typeof v === 'function') {
        // Removed: capturedRenderPage = true;
        queueMicrotask(() => {
          const processData = sandbox['processData'];
          const processedData = processData
            ? processData(initData)
            : initData;
          v(processedData);
          elementAPIs.__FlushElementTree();
          resolveRender(binding.ssrResult);
        });
      }
    },
    configurable: true,
    enumerable: true,
  });

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
  }

  return renderPromise;
}
