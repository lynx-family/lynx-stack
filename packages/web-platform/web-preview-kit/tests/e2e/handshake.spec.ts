// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// The handshake of the kit as the top-level page, and the checks of the
// environment that decide `hello.supported`.

import path from 'node:path';

import type { Page } from '@playwright/test';

import { expect, test } from './coverage.js';
import {
  openKit,
  sampleProject,
  start,
  staticFixtureRoute,
} from './harness.js';
import type { Servers } from './harness.js';
import { packageDir, workersDir } from './paths.js';

const CHANNEL = 'lynx-web-preview';

let servers: Servers;

test.beforeAll(async () => {
  servers = await start({
    kitOverrides: {
      '/bundler-worker.js': path.join(workersDir, 'static-worker.js'),
    },
    kitRoutes: [staticFixtureRoute],
  });
});

test.afterAll(async () => {
  await servers.close();
});

function warnings(page: Page): string[] {
  const seen: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'warning') {
      seen.push(message.text());
    }
  });
  return seen;
}

test('the kit announces itself to the page and answers probes', async ({ page }) => {
  const kit = await openKit(page, servers);
  expect(kit.hello).toEqual({
    version: 1,
    supported: true,
    builtinPackages: { '@lynx-js/react': 'fixture' },
  });
  expect(await page.evaluate(() => window.kit.readies)).toEqual([
    { channel: CHANNEL, type: 'ready', versions: [1] },
  ]);

  // Other messages are ignored; a probe is answered with `ready`. Window
  // messages arrive in order, so the answer to the probe comes after the
  // others were handled.
  await page.evaluate((channel) => {
    for (
      const message of [
        null,
        'text',
        { channel: 'another', type: 'probe' },
        { channel, type: 'unknown' },
        { channel, type: 'probe' },
      ]
    ) {
      window.postMessage(message, '*');
    }
  }, CHANNEL);
  await expect.poll(() => page.evaluate(() => window.kit.readies.length))
    .toBe(2);
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.kit.readies.length)).toBe(2);
});

test('connect needs version 1 and exactly one port', async ({ page }) => {
  const seen = warnings(page);
  const kit = await openKit(page, servers);
  const answered = await page.evaluate(async (channel) => {
    const attempts = [
      { version: 2, ports: 1 },
      { version: 1, ports: 0 },
      { version: 1, ports: 2 },
    ];
    const result: boolean[] = [];
    for (const { version, ports } of attempts) {
      const channels = Array.from(
        { length: ports },
        () => new MessageChannel(),
      );
      let got = false;
      for (const item of channels) {
        item.port1.onmessage = () => {
          got = true;
        };
      }
      window.postMessage(
        { channel, type: 'connect', version },
        '*',
        channels.map(item => item.port2),
      );
      await new Promise(resolve => setTimeout(resolve, 300));
      result.push(got);
    }
    return result;
  }, CHANNEL);
  expect(answered).toEqual([false, false, false]);
  expect(seen.filter(text => text.includes('ignored a connect message')))
    .toHaveLength(3);
  // The first session is still open.
  expect(await kit.requestError('fs.list')).toBe('NOT_OPEN');
});

test('a second connect replaces the port and keeps the project', async ({ page }) => {
  const kit = await openKit(page, servers);
  const { files, config } = await sampleProject();
  await kit.request('project.open', { files, config });
  await kit.waitForEvents('preview.load', 1);
  await expect(kit.card.locator('#title')).toHaveText('Main card');

  const second = await page.evaluate(async (channel) => {
    const { port1, port2 } = new MessageChannel();
    const messages: unknown[] = [];
    const hello = new Promise((resolve) => {
      port1.onmessage = (event: MessageEvent) => {
        messages.push(event.data);
        if ((event.data as { event?: string }).event === 'hello') {
          resolve((event.data as { data: unknown }).data);
        }
      };
    });
    window.postMessage({ channel, type: 'connect', version: 1 }, '*', [port2]);
    const helloData = await hello;
    port1.postMessage({ id: 1, method: 'fs.list' });
    // The first port is closed by the kit: a request on it gets no answer.
    window.kit.send({ id: 99, method: 'fs.list' });
    await new Promise(resolve => setTimeout(resolve, 500));
    return {
      hello: helloData,
      messages,
      oldPortAnswered: window.kit.responses.some(response =>
        (response as { id: number }).id === 99
      ),
    };
  }, CHANNEL);
  expect(second.hello).toEqual(kit.hello);
  expect(second.messages).toContainEqual({
    id: 1,
    result: { files: Object.keys(files).sort() },
  });
  expect(second.oldPortAnswered).toBe(false);
  await expect(kit.card.locator('#title')).toHaveText('Main card');
});

test('another window cannot connect', async ({ page }) => {
  const kit = await openKit(page, servers);

  // A child frame of the kit.
  const child = await page.evaluate(async (channel) => {
    const iframe = document.createElement('iframe');
    const answer = new Promise<string>((resolve) => {
      window.addEventListener('message', (event) => {
        if (event.data === 'answered' || event.data === 'silent') {
          resolve(event.data);
        }
      });
    });
    iframe.srcdoc = `<script>
      const channel = new MessageChannel();
      channel.port1.onmessage = () => parent.postMessage('answered', '*');
      parent.postMessage({ channel: '${channel}', type: 'probe' }, '*');
      parent.postMessage({ channel: '${channel}', type: 'connect', version: 1 }, '*', [channel.port2]);
      setTimeout(() => parent.postMessage('silent', '*'), 500);
    </script>`;
    document.body.append(iframe);
    return answer;
  }, CHANNEL);
  expect(child).toBe('silent');
  // Its probe was not answered either.
  expect(await page.evaluate(() => window.kit.readies.length)).toBe(1);

  // An opener: this page opens another kit page and tries to connect to it.
  const popupPromise = page.waitForEvent('popup');
  await page.evaluate(() => {
    (window as unknown as { popup: Window | null }).popup = window.open(
      location.href,
    );
  });
  const popup = await popupPromise;
  await popup.waitForLoadState('load');
  const fromOpener = await page.evaluate(async (channel) => {
    const { port1, port2 } = new MessageChannel();
    let got = false;
    port1.onmessage = () => {
      got = true;
    };
    (window as unknown as { popup: Window }).popup.postMessage(
      { channel, type: 'connect', version: 1 },
      '*',
      [port2],
    );
    await new Promise(resolve => setTimeout(resolve, 1000));
    return got;
  }, CHANNEL);
  expect(fromOpener).toBe(false);
  // The popup's own script can.
  const own = await popup.evaluate((channel) =>
    new Promise((resolve) => {
      const { port1, port2 } = new MessageChannel();
      port1.onmessage = event => resolve(event.data);
      window.postMessage({ channel, type: 'connect', version: 1 }, '*', [
        port2,
      ]);
    }), CHANNEL);
  expect(own).toEqual({ event: 'hello', data: kit.hello });
  await popup.close();
});

test.describe('hello.supported', () => {
  test('is false without cross-origin isolation', async ({ page }) => {
    const kit = await openKit(page, servers, { dip: false });
    expect(kit.hello.supported).toBe(false);
    expect(kit.hello.reason).toMatch(/not cross-origin isolated/);
    expect(kit.hello.builtinPackages).toEqual({});
    const { files, config } = await sampleProject();
    expect(await kit.requestError('project.open', { files, config })).toBe(
      'UNSUPPORTED',
    );
    const response = await kit.respond('fs.list');
    expect(response).toMatchObject({
      error: { code: 'UNSUPPORTED', message: kit.hello.reason },
    });
    // Closing what is not open is not an error.
    expect(await kit.respond('project.close')).toEqual({
      id: expect.any(Number),
    });
  });

  for (
    const { name, overrides, reason } of [
      {
        name: 'the Service Worker cannot start',
        overrides: { '/sw.js': path.join(packageDir, 'missing/sw.js') },
        reason: /^Cannot start the Service Worker: /,
      },
      {
        name: 'the bundler worker does not load',
        overrides: {
          '/bundler-worker.js': path.join(packageDir, 'missing/worker.js'),
        },
        reason: /^Error: The bundler worker failed: /,
      },
      {
        name: 'the kit was deployed without the bundle kit',
        overrides: {
          '/bundle-kit/index.js': path.join(packageDir, 'missing/index.js'),
        },
        reason: /^Error: Cannot load @lynx-js\/web-bundle-kit: /,
      },
    ]
  ) {
    test(`is false when ${name}`, async ({ page }) => {
      const broken = await start({ kitOverrides: overrides });
      try {
        const kit = await openKit(page, broken);
        expect(kit.hello.supported).toBe(false);
        expect(kit.hello.reason).toMatch(reason);
        expect(await kit.requestError('fs.list')).toBe('UNSUPPORTED');
      } finally {
        await broken.close();
      }
    });
  }
});
