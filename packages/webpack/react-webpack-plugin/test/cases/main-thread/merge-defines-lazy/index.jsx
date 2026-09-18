/// <reference types="vitest/globals" />

import fs from 'node:fs/promises';
import path from 'node:path';

import('./LazyPart.jsx');

export function App() {
  return (
    <view>
      <text attr-main='marker-root' />
    </view>
  );
}

const marker = (name) => eval(`['marker', '${name}'].join('-')`);

it('keeps the lazy-only definition out of the entry', async () => {
  if (__JS__) {
    return;
  }
  const content = await fs.readFile(__filename, 'utf-8');

  expect(content).not.toContain(marker('lazy-only'));
});

it('injects the lazy-only definition into the lazy chunk', async () => {
  if (__JS__) {
    return;
  }
  const dir = path.dirname(__filename);
  const files = await fs.readdir(dir);
  const contents = await Promise.all(
    files
      .filter((file) =>
        file.endsWith('.js') && path.join(dir, file) !== __filename
      )
      .map((file) => fs.readFile(path.join(dir, file), 'utf-8')),
  );

  expect(
    contents.some((content) =>
      content.includes('__lynx-react-defines')
      && content.includes(marker('lazy-only'))
    ),
  ).toBe(true);
});
