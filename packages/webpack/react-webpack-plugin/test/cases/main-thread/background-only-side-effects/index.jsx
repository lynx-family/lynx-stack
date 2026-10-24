/// <reference types="vitest/globals" />

import fs from 'node:fs/promises';

import { Feed } from './feed.jsx';

class HostMonitor {
  constructor() {
    console.info('marker-host-monitor-constructed');
  }
}

const hostMonitor = new HostMonitor();

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

it('drops the top-level side effects of a module only the children reach', async () => {
  if (__JS__) {
    return;
  }
  const content = await fs.readFile(__filename, 'utf-8');

  expect(content).not.toContain(marker('monitor-constructed'));
  expect(content).not.toContain(marker('monitor-started'));
});

it('keeps the top-level side effects of the module holding the boundary', async () => {
  if (__JS__) {
    return;
  }
  const content = await fs.readFile(__filename, 'utf-8');

  expect(hostMonitor).toBeDefined();
  expect(content).toContain(marker('host-monitor-constructed'));
});
