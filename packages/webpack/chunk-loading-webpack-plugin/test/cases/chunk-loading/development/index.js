/// <reference types="vitest/globals" />

import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(__filename);

vi.stubGlobal('lynx', {
  requireModuleAsync: vi.fn(function requireModuleAsync(request, callback) {
    return Promise.resolve().then(() => {
      try {
        callback(null, require(path.join(__dirname, request)));
      } catch (error) {
        callback(error);
      }
    });
  }),
});

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

it('should contain startup chunk dependencies code', async () => {
  const bundlePath = path.join(
    __dirname,
    'rspack.bundle.js',
  );
  const content = await fs.promises.readFile(bundlePath, 'utf-8');
  // why appears twice:
  //  1. Injected by StartupChunkDependenciesPlugin
  //  2. Existing in test case's own bundle
  expect((content.match(/Lynx startup chunk dependencies/g) || []).length).toBe(
    2,
  );
});
