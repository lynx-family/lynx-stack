/// <reference types="vitest/globals" />

import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(__filename);

vi.stubGlobal('lynx', {
  requireModule: vi.fn(function requireModule(request, _callback) {
    return require(path.join(__dirname, request));
  }),
});

it('should have dynamic chunks', () => {
  expect(
    fs.existsSync(
      path.join(
        __dirname,
        'sync-chunk-loading_production_dynamic_js.'
          + path.basename(__filename).replace('.js', '.cjs'),
      ),
    ),
  ).toBeTruthy();
});

it('should work with chunk loading require', async function() {
  await import('./dynamic.js').then(module => {
    expect(module.value).toBe(1);
    expect(lynx.requireModule).toBeCalled();
  });
  expect.assertions(3);
});
