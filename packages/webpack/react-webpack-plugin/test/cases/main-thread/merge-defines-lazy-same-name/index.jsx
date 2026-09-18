/// <reference types="vitest/globals" />

import fs from 'node:fs/promises';
import path from 'node:path';

import('./a/index.jsx');
import('./b/index.jsx');

export function App() {
  return (
    <view>
      <text attr-main='marker-root' />
    </view>
  );
}

const marker = (name) => eval(`['marker', '${name}'].join('-')`);

async function lazyChunks() {
  const dir = path.dirname(__filename);
  const files = await fs.readdir(dir);
  return Promise.all(
    files
      .filter((file) =>
        file.endsWith('.js') && path.join(dir, file) !== __filename
      )
      .map((file) => fs.readFile(path.join(dir, file), 'utf-8')),
  );
}

it('gives each same-named boundary its own definitions', async () => {
  if (__JS__) {
    return;
  }
  const chunks = await lazyChunks();
  const withA = chunks.filter((content) =>
    content.includes('__lynx-react-defines')
    && content.includes(marker('lazy-a-only'))
  );
  const withB = chunks.filter((content) =>
    content.includes('__lynx-react-defines')
    && content.includes(marker('lazy-b-only'))
  );

  expect(withA.length).toBe(1);
  expect(withB.length).toBe(1);
  expect(withA[0]).not.toContain(marker('lazy-b-only'));
  expect(withB[0]).not.toContain(marker('lazy-a-only'));
});
