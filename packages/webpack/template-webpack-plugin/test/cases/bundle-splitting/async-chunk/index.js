/// <reference types="@rstest/core/globals" />

import fs from 'node:fs';
import path from 'node:path';

import('./dynamic.js');
import('./dynamic2.js');
import('./dynamic3.js');

it('should contain initial chunks in app-service.js', async () => {
  const target = path.resolve(__dirname, '.rspeedy/main/tasm.json');
  expect(fs.existsSync(target));

  const content = await fs.promises.readFile(target, 'utf-8');

  const { manifest } = JSON.parse(content);

  expect(manifest).toHaveProperty('/app-service.js');

  const expected = ['***', 'dynamic', '***'].join('');
  expect(manifest['/app-service.js']).not.toHaveProperty(
    expected,
  );
  const expected2 = ['***', 'dynamic2', '***'].join('');
  expect(manifest['/app-service.js']).not.toHaveProperty(
    expected2,
  );
  const expected3 = ['***', 'dynamic3', '***'].join('');
  expect(manifest['/app-service.js']).not.toHaveProperty(
    expected3,
  );
});

it('should generate correct async chunk', async () => {
  const expected = ['***', 'dynamic', '***'].join('');
  const content = await fs.promises.readFile(
    path.resolve(
      __dirname,
      `.rspeedy/lazy-bundle/bundle-splitting/async-chunk/dynamic.js.js`,
    ),
    'utf-8',
  );
  expect(content).toContain(expected);

  const expected2 = ['***', 'dynamic2', '***'].join('');
  const content2 = await fs.promises.readFile(
    path.resolve(
      __dirname,
      `.rspeedy/lazy-bundle/bundle-splitting/async-chunk/dynamic2.js.js`,
    ),
    'utf-8',
  );
  expect(content2).toContain(expected2);

  const expected3 = ['***', 'dynamic3', '***'].join('');
  const content3 = await fs.promises.readFile(
    path.resolve(
      __dirname,
      `.rspeedy/lazy-bundle/bundle-splitting/async-chunk/dynamic3.js.js`,
    ),
    'utf-8',
  );
  expect(content3).toContain(expected3);
});
