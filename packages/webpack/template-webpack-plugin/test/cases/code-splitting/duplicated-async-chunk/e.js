/// <reference types="vitest/globals" />

import fs from 'node:fs';
import path from 'node:path';

console.info('**eee**');

it('should have foo', async () => {
  const { foo } = await import(
    /* webpackChunkName: "foo" */
    './shared/foo.js'
  );

  await expect(foo()).resolves.toBe('foo bar baz');
});

it('should have correct tasm.json', async () => {
  const target = path.resolve(
    path.dirname(__dirname),
    '.rspeedy',
    path.basename(__dirname),
    'tasm.json',
  );
  expect(fs.existsSync(target));

  const content = await fs.promises.readFile(target, 'utf-8');

  const { manifest } = JSON.parse(content);

  expect(manifest['/e/e.js']).toContain(['**', 'eee', '**'].join(''));
});

it('should generate correct bundle', async () => {
  const foo = path.resolve(
    __dirname,
    `../async/foo.${__webpack_hash__}.bundle`,
  );
  const bar = path.resolve(
    __dirname,
    `../async/bar.${__webpack_hash__}.bundle`,
  );
  const baz = path.resolve(
    __dirname,
    `../async/baz.${__webpack_hash__}.bundle`,
  );

  expect([foo, bar, baz].every(p => fs.existsSync(p))).toBeTruthy();

  const fooContent = await fs.promises.readFile(foo, 'utf-8');
  expect(fooContent).toContain('function foo()');

  const barContent = await fs.promises.readFile(bar, 'utf-8');
  expect(barContent).toContain('function bar()');

  const bazContent = await fs.promises.readFile(baz, 'utf-8');
  expect(bazContent).toContain('function baz()');

  const asyncTemplates = await fs.promises.readdir(
    path.resolve(__dirname, '../async'),
  );
  expect(asyncTemplates).toHaveLength(3); // foo, bar, baz
});
