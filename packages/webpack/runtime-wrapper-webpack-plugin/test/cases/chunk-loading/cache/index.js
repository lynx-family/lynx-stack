/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
/// <reference types="@rspack/test-tools/rstest" />

import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(__filename);

it('should have dynamic chunks', () => {
  const chunkPath = path.join(
    __dirname,
    'chunk-loading_cache_dynamic_js.'
      + path.basename(__filename).replace('.js', '.cjs'),
  );

  expect(fs.existsSync(chunkPath)).toBeTruthy();

  g.bundleSupportLoadScript = true;
  require(chunkPath);

  const { init } = g.__bundle__holder;

  expect(typeof init).toBe('function');

  const tt = createTT();
  const chunk = init({ tt });
  expect(chunk).toHaveProperty('ids', ['chunk-loading_cache_dynamic_js']);
  expect(chunk).toHaveProperty('modules');
  expect(chunk.modules).toHaveProperty('./chunk-loading/cache/dynamic.js');
  expect(typeof chunk.modules['./chunk-loading/cache/dynamic.js']).toBe(
    'function',
  );

  const module = {
    exports: {},
  };
  chunk.modules['./chunk-loading/cache/dynamic.js'](
    module,
    module.exports,
    __webpack_require__,
  );
  expect(module.exports).toHaveProperty('value', 1);

  const module2 = {
    exports: {},
  };
  chunk.modules['./chunk-loading/cache/dynamic.js'](
    module2,
    module2.exports,
    __webpack_require__,
  );
  expect(module2.exports).toHaveProperty('value', 1);

  // Execute with the same tt
  const chunk2 = init({ tt });
  expect(chunk2).toHaveProperty('ids', ['chunk-loading_cache_dynamic_js']);
  expect(chunk2).toHaveProperty('modules');
  expect(chunk2.modules).toHaveProperty('./chunk-loading/cache/dynamic.js');
  expect(typeof chunk2.modules['./chunk-loading/cache/dynamic.js']).toBe(
    'function',
  );

  // Execute with a new tt
  const chunk3 = init({ tt: createTT() });
  expect(chunk3).toHaveProperty('ids', ['chunk-loading_cache_dynamic_js']);
  expect(chunk3).toHaveProperty('modules');
  expect(chunk3.modules).toHaveProperty('./chunk-loading/cache/dynamic.js');
  expect(typeof chunk3.modules['./chunk-loading/cache/dynamic.js']).toBe(
    'function',
  );
});

it('should work with chunk loading require', async function() {
  try {
    await import('./dynamic.js');
    expect.fail('Should not load chunk here');
  } catch {
    // ignore error
  }
});

function createTT() {
  const modules = new Map();

  return {
    define(mod, factory) {
      modules.set(mod, factory);
    },
    require(mod) {
      const factory = modules.get(mod);
      const module = {
        exports: {},
      };
      const ret = factory(
        this.require,
        module,
        module.exports,
        null,
        setTimeout,
        setInterval,
        clearInterval,
        clearTimeout,
        null,
        null,
        console,
      );
      return ret ?? module.exports;
    },
  };
}
