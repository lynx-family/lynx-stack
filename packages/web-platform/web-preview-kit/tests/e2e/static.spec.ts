// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// Stage 1: the runtime half of the kit with a substitute bundler worker that
// emits a fixture built in Node.

import path from 'node:path';

import { expect, test } from '@playwright/test';

import { openDemo, start, staticFixtureRoute } from './harness.js';
import type { Servers } from './harness.js';
import { workersDir } from './paths.js';

let servers: Servers;

test.beforeAll(async () => {
  servers = await start({
    kitOverrides: {
      '/bundler-worker.js': path.join(workersDir, 'static-worker.js'),
      '/xhr-probe-worker.js': path.join(workersDir, 'xhr-probe-worker.js'),
    },
    kitRoutes: [staticFixtureRoute],
  });
});

test.afterAll(async () => {
  await servers.close();
});

for (
  const mode of [
    {
      name: 'an isolated host with allow="cross-origin-isolated"',
      isolated: true,
      dip: false,
    },
    {
      name: 'a non-isolated host and Document-Isolation-Policy',
      isolated: false,
      dip: true,
    },
  ]
) {
  test(`renders, switches, reloads and updates data with ${mode.name}`, async ({ page }) => {
    const demo = await openDemo(page, servers, mode);
    expect(demo.hello).toMatchObject({
      version: 1,
      supported: true,
      builtinPackages: { '@lynx-js/react': 'fixture' },
    });

    const files = await page.evaluate(() => window.demo.sampleFiles);
    const config = await page.evaluate(() => window.demo.sampleConfig);
    expect(await demo.request('project.open', { files, config })).toEqual({
      revision: 1,
    });
    const [done] = await demo.waitForEvents('build.done', 1);
    expect(done).toMatchObject({ buildId: 1, revision: 1, success: true });
    expect(await demo.events('build.start')).toEqual([
      { event: 'build.start', data: { buildId: 1, revision: 1 } },
    ]);
    const [load] = await demo.waitForEvents('preview.load', 1);
    expect(load).toEqual({ card: 'main', hash: done!.hash, reason: 'open' });

    // The card is served by the Service Worker: the server has nothing under
    // `__lynx_preview__`.
    await expect(demo.card.locator('#title')).toHaveText('Main card');
    const cardUrl = await demo.card.evaluate(view =>
      (view as unknown as { url: string }).url
    );
    expect(cardUrl).toMatch(
      new RegExp(
        `^${servers.kitOrigin}/__lynx_preview__/[^/]+/\\.cards/1/main\\.web\\.bundle\\?load=1$`,
      ),
    );
    await expect(demo.card.locator('.page')).toHaveCSS(
      'background-color',
      'rgb(255, 0, 0)',
    );

    expect(
      (await demo.request('build.getAsset', { name: 'main.web.bundle' }))
        .content,
    ).toBeTruthy();

    // preview.select
    expect(await demo.request('preview.select', { card: 'detail' })).toEqual({
      card: 'detail',
    });
    await expect(demo.card.locator('#title')).toHaveText('Detail card');
    await expect(demo.card.locator('.detail')).toHaveCSS(
      'background-color',
      'rgb(0, 0, 255)',
    );
    expect((await demo.waitForEvents('preview.load', 2))[1]).toEqual({
      card: 'detail',
      hash: done!.hash,
      reason: 'select',
    });
    await demo.request('preview.select', { card: 'main' });
    await expect(demo.card.locator('#title')).toHaveText('Main card');

    // preview.reload creates a new card.
    await demo.card.evaluate(view => view.setAttribute('data-marker', '1'));
    await demo.request('preview.reload');
    expect((await demo.waitForEvents('preview.load', 4))[3]).toMatchObject({
      card: 'main',
      reason: 'reload',
    });
    await expect(demo.card).not.toHaveAttribute('data-marker', '1');
    await expect(demo.card.locator('#title')).toHaveText('Main card');
    const reloadedUrl = await demo.card.evaluate(view =>
      (view as unknown as { url: string }).url
    );
    expect(reloadedUrl).toMatch(/\?load=4$/);

    // preview.setData reaches the running card.
    await demo.request('preview.setData', {
      initData: { greeting: 'hi' },
      globalProps: { theme: 'dark' },
    });
    await expect(demo.card.locator('#init-data')).toHaveText(
      '{"greeting":"hi"}',
    );
    await expect(demo.card.locator('#global-props')).toHaveText(
      '{"theme":"dark"}',
    );
    // ... and to the cards loaded later.
    await demo.request('preview.reload');
    await expect(demo.card.locator('#init-data')).toHaveText(
      '{"greeting":"hi"}',
    );

    // File requests go to the bundler worker.
    expect(await demo.request('fs.list')).toEqual({
      files: Object.keys(files).sort(),
    });
    expect(await demo.request('fs.read', { path: 'src/main.css' })).toEqual({
      content: files['src/main.css'],
    });
    expect(await demo.requestError('fs.read', { path: '/abs' })).toBe(
      'INVALID_PATH',
    );
    expect(await demo.requestError('fs.read', { path: 'nope.ts' })).toBe(
      'NOT_FOUND',
    );
    expect(await demo.requestError('preview.select', { card: 'x' })).toBe(
      'UNKNOWN_CARD',
    );
  });
}

test('reports supported: false without cross-origin isolation', async ({ page }) => {
  const demo = await openDemo(page, servers, { isolated: false, dip: false });
  expect(demo.hello.supported).toBe(false);
  expect(demo.hello.reason).toMatch(/cross-origin isolated/);
  expect(
    await demo.requestError('project.open', {
      files: {},
      config: { entries: { main: 'src/main.tsx' } },
    }),
  ).toBe('UNSUPPORTED');
});

for (
  const mode of [
    { name: 'an isolated host', isolated: true, dip: false },
    { name: 'Document-Isolation-Policy', isolated: false, dip: true },
  ]
) {
  test(`a dedicated module worker gets a synchronous XHR answered by the Service Worker, with ${mode.name}`, async ({ page }) => {
    await openDemo(page, servers, mode);
    const frame = page.frame({ url: /\/index\.html/ })!;
    const kitFrame = page.frames().find(item =>
      item.url().startsWith(servers.kitOrigin)
    )!;
    expect(frame).toBeTruthy();
    const result = await kitFrame.evaluate(async () => {
      const scope = new URL('./', location.href).href;
      const url = `${scope}__lynx_preview__/probe/data/hello.json`;
      const cache = await caches.open('lynx-preview:probe');
      await cache.put(
        url,
        new Response('{"hello":"from the cache"}', {
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      const worker = new Worker(`${scope}xhr-probe-worker.js`, {
        type: 'module',
      });
      const answer = await new Promise((resolve) => {
        worker.onmessage = event => resolve(event.data);
        worker.postMessage(`${url}?v=1`);
      });
      worker.terminate();
      await caches.delete('lynx-preview:probe');
      return {
        answer,
        page: {
          crossOriginIsolated,
          controlled: navigator.serviceWorker.controller !== null,
        },
      };
    });
    expect(result).toEqual({
      answer: {
        status: 200,
        text: '{"hello":"from the cache"}',
        crossOriginIsolated: true,
        sharedArrayBuffer: true,
      },
      page: { crossOriginIsolated: true, controlled: true },
    });
  });
}
