/// <reference types="vitest/globals" />

import fs from 'node:fs';
import path from 'node:path';

console.info('**bbb**');

it('should have "bbb" in b.lepus.js', async () => {
  const target = path.resolve(__dirname, 'b.lepus.js');
  expect(fs.existsSync(target));

  const content = await fs.promises.readFile(target, 'utf-8');

  expect(content).toContain(['**', 'bbb', '**'].join(''));

  const jsContent = await fs.promises.readFile(__filename, 'utf-8');

  expect(content).toBe(jsContent);
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

  const output = path.resolve(__dirname, 'b.js');
  expect(fs.existsSync(output));

  const outputContent = await fs.promises.readFile(output, 'utf-8');

  const { lepusCode, manifest } = JSON.parse(content);

  expect(lepusCode).toHaveProperty('root', outputContent);
  expect(outputContent).toContain(['**', 'bbb', '**'].join(''));
  expect(manifest['/app-service.js']).toContain(
    `lynx.requireModule('/b/b.js',globDynamicComponentEntry?globDynamicComponentEntry:'__Card__')`,
  );
});
