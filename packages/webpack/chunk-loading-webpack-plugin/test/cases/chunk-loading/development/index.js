/// <reference types="@rspack/test-tools/rstest" />

import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(__filename);

globalThis.lynx = {
  requireModuleAsync: rstest.fn(function requireModuleAsync(request, callback) {
    return Promise.resolve().then(() => {
      try {
        callback(null, require(path.join(__dirname, request)));
      } catch (error) {
        callback(error);
      }
    });
  }),
};

it('should have dynamic chunks', () => {
  expect(
    fs.existsSync(
      path.join(
        __dirname,
        'chunk-loading_development_dynamic_js.'
          + path.basename(__filename).replace('.js', '.cjs'),
      ),
    ),
  ).toBeTruthy();
});

it('should work with chunk loading require', async function() {
  await import('./dynamic.js').then(module => {
    expect(module.value).toBe(1);
    expect(lynx.requireModuleAsync).toBeCalled();
  });
});
