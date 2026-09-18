/// <reference types="vitest/globals" />

import fs from 'node:fs/promises';

import { Feed } from './feed.jsx';

export function App() {
  return (
    <view>
      <background-only fallback={<text attr-fallback='marker-fallback' />}>
        <Feed />
      </background-only>
    </view>
  );
}

const marker = (name) => eval(`['marker', '${name}'].join('-')`);

it('keeps the fallback on the main thread', async () => {
  if (__JS__) {
    return;
  }
  const content = await fs.readFile(__filename, 'utf-8');

  expect(content).toContain(marker('fallback'));
});

it('injects the children snapshot into the main thread', async () => {
  if (__JS__) {
    return;
  }
  const content = await fs.readFile(__filename, 'utf-8');

  expect(content).toContain(marker('feed-content'));
});

it('injects the children worklet into the main thread', async () => {
  if (__JS__) {
    return;
  }
  const content = await fs.readFile(__filename, 'utf-8');

  expect(content).toContain(marker('feed-worklet'));
});

it('drops the children component logic from the main thread', async () => {
  if (__JS__) {
    return;
  }
  const content = await fs.readFile(__filename, 'utf-8');

  expect(content).not.toContain(marker('feed-logic'));
});
