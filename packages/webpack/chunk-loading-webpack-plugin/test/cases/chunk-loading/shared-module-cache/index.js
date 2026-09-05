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

it('keeps the instances of an installed chunk on the chunk object', async () => {
  await import('./dynamic.js');

  const [chunk] = loadedChunks;
  expect(chunk.__moduleCache).toBeTypeOf('object');

  const instances = Object.values(chunk.__moduleCache);
  expect(instances.some(module => module.exports.value === 1)).toBe(true);
});

it('resolves the chunk modules through the chunk-held instances', async () => {
  const module = await import('./dynamic.js');

  const [chunk] = loadedChunks;
  const moduleId = Object.keys(chunk.modules).find(id =>
    chunk.__moduleCache[id]?.exports.value === 1
  );

  // Dropping the instance from the chunk makes the page re-run the factory,
  // which is what proves the page reads through the chunk rather than through
  // a cache of its own.
  delete chunk.__moduleCache[moduleId];
  expect(__webpack_require__(moduleId).value).toBe(1);
  expect(chunk.__moduleCache[moduleId].exports).not.toBe(module);
});
