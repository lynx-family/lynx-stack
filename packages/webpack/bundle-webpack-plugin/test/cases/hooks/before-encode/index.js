/// <reference types="vitest/globals" />

import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

it('should have changed bundle', async () => {
  const content = await fs.readFile(
    path.resolve(__dirname, 'main.bundle'),
    'utf-8',
  );

  expect(content).contains('Hello' + ' ' + 'BeforeEncode');
});

it('should have changed lepusCode.filename', async () => {
  const target = path.resolve(
    __dirname,
    '.rspeedy',
    'tasm.json',
  );
  expect(existsSync(target));

  const content = await fs.readFile(target, 'utf-8');

  const { lepusCode } = JSON.parse(content);

  expect(lepusCode).toHaveProperty('filename', 'hello.lepus.js');
});
