import * as vm from 'vm';
import * as fs from 'fs';
import { decodeTemplate } from './decode.js';
import { decode_style_info } from './wasm.js';

export async function executeTemplate(filePath: string) {
  const context = vm.createContext({
    module: { exports: {} },
    exports: {},
    console: console,
    // Mock globals to match client environment if needed, though usage should be guarded
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    lynx: {
      // Mock basic lynx objects
      getCoreContext: () => ({}),
      __globalProps: {},
    },
  });

  const buffer = fs.readFileSync(filePath);
  const result = decodeTemplate(buffer);

  const config = result.config;

  // Style Info
  if (result.styleInfo) {
    try {
      decode_style_info(
        result.styleInfo,
        config['isLazy'] === 'true' ? filePath : undefined,
        config['enableCSSSelector'] === 'true',
      );
    } catch (e) {
      console.warn('Failed to decode style info:', e);
    }
  }

  // Lepus Code
  const rootCode = result.lepusCode['root'];
  if (rootCode) {
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

    vm.runInContext(wrappedCode, context, {
      filename: `${filePath}/root`,
    });
  }

  return context;
}
