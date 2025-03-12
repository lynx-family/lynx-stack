/// <reference types="vitest/globals" />

import fs from 'node:fs/promises';

import './react.js';
import './lynx-js-react.js';

it('should have useEffect func in background thread script', async () => {
  if (__LEPUS__) {
    return;
  }
  const expected = eval(
    `['This', 'should', 'not', 'exist', 'in', 'main-thread'].join(' ', )`,
  );
  const content = await fs.readFile(__filename, 'utf-8');

  expect(content).toContain(expected);
});

it('should not have useEffect func in main thread script', async () => {
  if (__JS__) {
    return;
  }
  const expected = eval(
    `['This', 'should', 'not', 'exist', 'in', 'main-thread'].join(' ', )`,
  );

  const content = await fs.readFile(
    __filename,
    'utf-8',
  );

  expect(content).not.toContain(expected);
});
