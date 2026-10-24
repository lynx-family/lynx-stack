/// <reference types="vitest/globals" />

import fs from 'node:fs/promises';

import { BackgroundOnly } from './background-only.jsx';
import { Shared } from './shared.jsx';

export function App() {
  return (
    <view>
      <Shared />
      {__MAIN_THREAD__
        ? <text attr-main='marker-main-only' />
        : <BackgroundOnly />}
    </view>
  );
}

const marker = (name) => eval(`['marker', '${name}'].join('-')`);

it('injects the background-only snapshot into the main thread', async () => {
  if (__JS__) {
    return;
  }
  const content = await fs.readFile(__filename, 'utf-8');

  expect(content).toContain(marker('background-only'));
});

it('injects the background-only worklet into the main thread', async () => {
  if (__JS__) {
    return;
  }
  const content = await fs.readFile(__filename, 'utf-8');

  expect(content).toContain(marker('worklet-background'));
});

it('does not duplicate a definition the main thread already has', async () => {
  if (__JS__) {
    return;
  }
  const content = await fs.readFile(__filename, 'utf-8');

  expect(content.split(marker('shared')).length - 1).toBe(1);
});
