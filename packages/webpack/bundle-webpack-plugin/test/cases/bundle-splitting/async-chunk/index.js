/// <reference types="vitest/globals" />

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
      `bundle-splitting_async-chunk_dynamic_js.${path.basename(__filename)}`,
    ),
    'utf-8',
  );
  expect(content).toContain(expected);

  const expected2 = ['***', 'dynamic2', '***'].join('');
  const content2 = await fs.promises.readFile(
    path.resolve(
      __dirname,
      `bundle-splitting_async-chunk_dynamic2_js.${path.basename(__filename)}`,
    ),
    'utf-8',
  );
  expect(content2).toContain(expected2);

  const expected3 = ['***', 'dynamic3', '***'].join('');
  const content3 = await fs.promises.readFile(
    path.resolve(
      __dirname,
      `bundle-splitting_async-chunk_dynamic3_js.${path.basename(__filename)}`,
    ),
    'utf-8',
  );
  expect(content3).toContain(expected3);
});
