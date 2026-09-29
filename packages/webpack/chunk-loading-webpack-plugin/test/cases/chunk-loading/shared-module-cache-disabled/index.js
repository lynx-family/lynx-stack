/// <reference types="@rstest/core/globals" />

import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(__filename);

const loadedChunks = [];

globalThis.lynx = {
  requireModuleAsync: rstest.fn(function requireModuleAsync(request, callback) {
    return Promise.resolve().then(() => {
      try {
        const chunk = require(path.join(__dirname, request));
        loadedChunks.push(chunk);
        callback(null, chunk);
      } catch (error) {
        callback(error);
      }
    });
  }),
};

it('leaves the module instances in the runtime without the option', async () => {
  const module = await import('./dynamic.js');

  const [chunk] = loadedChunks;
  expect(chunk.__moduleCache).toBeUndefined();

  expect(__webpack_require__.c).toBeUndefined();
  expect(module.value).toBe(1);
});
