// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// The session of the kit page: revisions, builds, the previewed card, the
// failed-build rules, and serving builds from the Service Worker. The
// bundler worker is the static test double (`workers/static-worker.js`),
// which emits a fixture built in Node and is steered by the file
// `static-worker.json` of the project.

import path from 'node:path';

import { expect, test } from './coverage.js';
import {
  openKit,
  sampleProject,
  start,
  staticFixtureRoute,
} from './harness.js';
import type { Kit, Servers } from './harness.js';
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

const CONTROL = 'static-worker.json';

/** Steers the next builds of the static double. */
function control(options: { errors?: string[]; delayMs?: number }) {
  return {
    type: 'write' as const,
    path: CONTROL,
    content: JSON.stringify(options),
  };
}
const clearControl = { type: 'delete' as const, path: CONTROL };

/** Applies changes and waits for the build of their revision. */
async function rebuild(kit: Kit, changes: unknown[]) {
  const { revision } = await kit.request('fs.apply', {
    changes: changes as never,
  });
  const done = await kit.waitForEvent(
    'build.done',
    data => data.revision === revision,
  );
  return { revision, done };
}

async function cardUrl(kit: Kit): Promise<string> {
  return kit.card.evaluate(view => (view as unknown as { url: string }).url);
}

async function openSample(
  page: Parameters<typeof openKit>[0],
  options: { card?: string; data?: unknown; config?: object } = {},
) {
  const kit = await openKit(page, servers);
  const { files, config } = await sampleProject();
  const { config: overrides, ...rest } = options;
  expect(
    await kit.request('project.open', {
      files,
      config: { ...config, ...overrides },
      ...rest,
    } as never),
  ).toEqual({ revision: 1 });
  return { kit, files, config };
}

test('renders from the Service Worker, switches, reloads and updates data', async ({ page }) => {
  const { kit, files } = await openSample(page);
  const [done] = await kit.waitForEvents('build.done', 1);
  expect(done).toMatchObject({
    buildId: 1,
    revision: 1,
    success: true,
    errors: [],
    warnings: [],
    cards: [
      { name: 'main', entry: 'src/main.tsx', bundle: 'main.web.bundle' },
      { name: 'detail', entry: 'src/detail.tsx', bundle: 'detail.web.bundle' },
    ],
  });
  expect(await kit.events('build.start')).toEqual([
    { event: 'build.start', data: { buildId: 1, revision: 1 } },
  ]);
  const [load] = await kit.waitForEvents('preview.load', 1);
  expect(load).toEqual({ card: 'main', hash: done!.hash, reason: 'open' });

  // The card is served by the Service Worker: the server has nothing under
  // `__lynx_preview__`.
  await expect(kit.card.locator('#title')).toHaveText('Main card');
  expect(await cardUrl(kit)).toMatch(
    new RegExp(
      `^${servers.kitOrigin}/__lynx_preview__/[^/]+/\\.cards/1/main\\.web\\.bundle\\?load=1$`,
    ),
  );
  await expect(kit.card.locator('.page')).toHaveCSS(
    'background-color',
    'rgb(255, 0, 0)',
  );
  const size = await page.evaluate(async () => {
    const response = await window.kit.request('build.getAsset', {
      name: 'main.web.bundle',
    });
    return (response as { result: { content: Uint8Array } }).result.content
      .byteLength;
  });
  expect(size).toBe(
    done!.assets.find(asset => asset.name === 'main.web.bundle')!.size,
  );

  // preview.select
  expect(await kit.request('preview.select', { card: 'detail' })).toEqual({
    card: 'detail',
  });
  await expect(kit.card.locator('#title')).toHaveText('Detail card');
  await expect(kit.card.locator('.detail')).toHaveCSS(
    'background-color',
    'rgb(0, 0, 255)',
  );
  expect((await kit.waitForEvents('preview.load', 2))[1]).toEqual({
    card: 'detail',
    hash: done!.hash,
    reason: 'select',
  });
  await kit.request('preview.select', { card: 'main' });
  await expect(kit.card.locator('#title')).toHaveText('Main card');

  // preview.reload creates a new card.
  await kit.card.evaluate(view => view.setAttribute('data-marker', '1'));
  expect(await kit.request('preview.reload')).toBeUndefined();
  expect((await kit.waitForEvents('preview.load', 4))[3]).toMatchObject({
    card: 'main',
    reason: 'reload',
  });
  await expect(kit.card).not.toHaveAttribute('data-marker', '1');
  await expect(kit.card.locator('#title')).toHaveText('Main card');
  expect(await cardUrl(kit)).toMatch(/\?load=4$/);
  await expect(kit.card).toHaveCount(1);

  // preview.setData reaches the running card, and the cards loaded later.
  await kit.request('preview.setData', {
    initData: { greeting: 'hi' },
    globalProps: { theme: 'dark' },
  });
  await expect(kit.card.locator('#init-data')).toHaveText('{"greeting":"hi"}');
  await expect(kit.card.locator('#global-props')).toHaveText(
    '{"theme":"dark"}',
  );
  await kit.request('preview.setData', { globalProps: { theme: 'light' } });
  await expect(kit.card.locator('#global-props')).toHaveText(
    '{"theme":"light"}',
  );
  await kit.request('preview.reload');
  await expect(kit.card.locator('#init-data')).toHaveText('{"greeting":"hi"}');
  await expect(kit.card.locator('#global-props')).toHaveText(
    '{"theme":"light"}',
  );

  // File requests go to the bundler worker.
  expect(await kit.request('fs.list')).toEqual({
    files: Object.keys(files).sort(),
  });
  expect(await kit.request('fs.read', { path: 'src/main.css' })).toEqual({
    content: files['src/main.css'],
  });
});

test('project.open previews the requested card with its data, and replaces the open project', async ({ page }) => {
  const { kit, files, config } = await openSample(page, {
    card: 'main',
    data: { initData: { from: 'open' } },
  });
  await kit.waitForEvents('preview.load', 1);
  await expect(kit.card.locator('#init-data')).toHaveText('{"from":"open"}');

  expect(
    await kit.request('project.open', {
      files: { ...files, 'src/extra.ts': '' },
      config,
      card: 'detail',
    }),
  ).toEqual({ revision: 1 });
  const loads = await kit.waitForEvents('preview.load', 2);
  const builds = await kit.waitForEvents('build.done', 2);
  // Build ids count the builds of the session.
  expect(builds[1]).toMatchObject({ buildId: 2, revision: 1 });
  expect(loads[1]).toEqual({
    card: 'detail',
    hash: builds[1]!.hash,
    reason: 'open',
  });
  await expect(kit.card.locator('#title')).toHaveText('Detail card');
  expect((await kit.request('fs.list')).files).toContain('src/extra.ts');
});

test('a rebuild is a hot update while hot updates are on', async ({ page }) => {
  const { kit } = await openSample(page);
  await kit.waitForEvents('preview.load', 1);
  await kit.card.evaluate(view => view.setAttribute('data-marker', 'kept'));
  const { revision, done } = await rebuild(kit, [
    { type: 'write', path: 'src/extra.ts', content: 'export {};' },
  ]);
  expect(revision).toBe(2);
  expect(done).toMatchObject({ buildId: 2, revision: 2, success: true });
  expect(await kit.events('build.start')).toEqual([
    { event: 'build.start', data: { buildId: 1, revision: 1 } },
    { event: 'build.start', data: { buildId: 2, revision: 2 } },
  ]);
  expect(await kit.waitForEvent('preview.hmr')).toEqual({
    card: 'main',
    hash: done.hash,
  });
  expect(await kit.events('preview.load')).toHaveLength(1);
  await expect(kit.card).toHaveAttribute('data-marker', 'kept');
  // The events of a build come in order: start, done, then the update.
  const names = (await kit.events()).map(item => item.event);
  expect(names.slice(-3)).toEqual(['build.start', 'build.done', 'preview.hmr']);
});

for (
  const { name, config } of [
    { name: 'with hot updates off', config: { hmr: false } },
    { name: 'in production', config: { mode: 'production', hmr: true } },
  ]
) {
  test(`a rebuild reloads the card ${name}`, async ({ page }) => {
    const { kit } = await openSample(page, { config });
    await kit.waitForEvents('preview.load', 1);
    const { done } = await rebuild(kit, []);
    expect(
      await kit.waitForEvent('preview.load', data => data.hash === done.hash),
    )
      .toEqual({ card: 'main', hash: done.hash, reason: 'rebuild' });
    expect(await kit.events('preview.hmr')).toEqual([]);
    await expect(kit.card.locator('#title')).toHaveText('Main card');
  });
}

test('a failed build is reported, nothing follows, and the next success reloads the card', async ({ page }) => {
  const { kit } = await openSample(page);
  const [good] = await kit.waitForEvents('preview.load', 1);
  await kit.card.evaluate(view => view.setAttribute('data-marker', 'kept'));

  const failed = await rebuild(kit, [control({ errors: ['broken'] })]);
  expect(failed.done).toMatchObject({
    buildId: 2,
    success: false,
    cards: [],
    errors: [{ message: 'broken' }],
  });
  await page.waitForTimeout(300);
  expect(await kit.events('preview.hmr')).toEqual([]);
  expect(await kit.events('preview.load')).toHaveLength(1);
  await expect(kit.card).toHaveAttribute('data-marker', 'kept');

  // The failed build overwrote the card bundles; a reload uses the copy of
  // the last successful build.
  await kit.request('preview.reload');
  expect(
    await kit.waitForEvent('preview.load', data => data.reason === 'reload'),
  ).toEqual({ card: 'main', hash: good!.hash, reason: 'reload' });
  await expect(kit.card.locator('#title')).toHaveText('Main card');
  await expect(kit.card).not.toHaveAttribute('data-marker', 'kept');

  // A second failure changes nothing either.
  await rebuild(kit, [control({ errors: ['still broken'] })]);

  // The first success after a failure loads the card again.
  const fixed = await rebuild(kit, [clearControl]);
  expect(fixed.done.success).toBe(true);
  expect(
    await kit.waitForEvent(
      'preview.load',
      data => data.hash === fixed.done.hash,
    ),
  ).toEqual({ card: 'main', hash: fixed.done.hash, reason: 'hmr-fallback' });
  expect(await kit.events('preview.hmr')).toEqual([]);
  await expect(kit.card.locator('#title')).toHaveText('Main card');

  // Then hot updates again.
  const next = await rebuild(kit, []);
  expect(await kit.waitForEvent('preview.hmr')).toEqual({
    card: 'main',
    hash: next.done.hash,
  });
});

test('a card selected after a failed build reloads on the next success', async ({ page }) => {
  const { kit } = await openSample(page);
  const [good] = await kit.waitForEvents('preview.load', 1);
  await rebuild(kit, [control({ errors: ['broken'] })]);
  await kit.request('preview.select', { card: 'detail' });
  expect(
    await kit.waitForEvent('preview.load', data => data.reason === 'select'),
  ).toEqual({ card: 'detail', hash: good!.hash, reason: 'select' });
  await expect(kit.card.locator('#title')).toHaveText('Detail card');

  const fixed = await rebuild(kit, [clearControl]);
  expect(
    await kit.waitForEvent(
      'preview.load',
      data => data.hash === fixed.done.hash,
    ),
  ).toEqual({ card: 'detail', hash: fixed.done.hash, reason: 'hmr-fallback' });
  expect(await kit.events('preview.hmr')).toEqual([]);
});

test('nothing loads before the first successful build', async ({ page }) => {
  const kit = await openKit(page, servers);
  const { files, config } = await sampleProject();
  await kit.request('project.open', {
    files: { ...files, [CONTROL]: JSON.stringify({ errors: ['broken'] }) },
    config,
  });
  const [failed] = await kit.waitForEvents('build.done', 1);
  expect(failed).toMatchObject({ success: false, cards: [] });
  // Neither a reload nor a selection loads anything.
  expect(await kit.request('preview.reload')).toBeUndefined();
  expect(await kit.request('preview.select', { card: 'detail' })).toEqual({
    card: 'detail',
  });
  await page.waitForTimeout(300);
  expect(await kit.events('preview.load')).toEqual([]);
  await expect(kit.card).toHaveCount(0);

  // A failure before the card was first loaded is no reason to fall back.
  const fixed = await rebuild(kit, [clearControl]);
  expect(await kit.waitForEvent('preview.load')).toEqual({
    card: 'detail',
    hash: fixed.done.hash,
    reason: 'open',
  });
  await expect(kit.card.locator('#title')).toHaveText('Detail card');
  const next = await rebuild(kit, []);
  expect(await kit.waitForEvent('preview.hmr')).toEqual({
    card: 'detail',
    hash: next.done.hash,
  });
});

test('a card selected while the first build runs loads with it', async ({ page }) => {
  const kit = await openKit(page, servers);
  const { files, config } = await sampleProject();
  await kit.request('project.open', {
    files: { ...files, [CONTROL]: JSON.stringify({ delayMs: 500 }) },
    config,
  });
  await kit.request('preview.select', { card: 'detail' });
  const [done] = await kit.waitForEvents('build.done', 1);
  expect(await kit.waitForEvent('preview.load')).toEqual({
    card: 'detail',
    hash: done!.hash,
    reason: 'open',
  });
  expect(await kit.events('preview.load')).toHaveLength(1);
});

test('project.configure keeps the files and opens the card again', async ({ page }) => {
  const { kit, files, config } = await openSample(page);
  await kit.waitForEvents('preview.load', 1);
  await kit.request('preview.select', { card: 'detail' });

  // The previewed card is still an entry.
  expect(
    await kit.request('project.configure', {
      config: { entries: { ...config.entries, extra: 'src/main.tsx' } },
    }),
  ).toEqual({ revision: 2 });
  const configured = await kit.waitForEvent(
    'build.done',
    data => data.revision === 2,
  );
  expect(configured.cards.map(card => card.name)).toEqual([
    'main',
    'detail',
    'extra',
  ]);
  expect(
    await kit.waitForEvent(
      'preview.load',
      data => data.hash === configured.hash,
    ),
  ).toEqual({ card: 'detail', hash: configured.hash, reason: 'open' });
  await expect(kit.card.locator('#title')).toHaveText('Detail card');

  // It is not: the first entry is previewed instead.
  expect(
    await kit.request('project.configure', {
      config: { entries: { main: 'src/main.tsx' } },
    }),
  ).toEqual({ revision: 3 });
  const reduced = await kit.waitForEvent(
    'build.done',
    data => data.revision === 3,
  );
  expect(
    await kit.waitForEvent('preview.load', data => data.hash === reduced.hash),
  ).toEqual({ card: 'main', hash: reduced.hash, reason: 'open' });
  expect(await kit.requestError('preview.select', { card: 'detail' })).toBe(
    'UNKNOWN_CARD',
  );
  expect(await kit.request('fs.list')).toEqual({
    files: Object.keys(files).sort(),
  });
  expect(await kit.request('fs.apply', { changes: [] })).toEqual({
    revision: 4,
  });
});

test('project.open, project.configure and project.close cancel a running build', async ({ page }) => {
  const { kit, files, config } = await openSample(page);
  await kit.waitForEvents('preview.load', 1);
  const slow = control({ delayMs: 1000 });

  // configure: its own build is slow too, and only it is reported.
  await kit.request('fs.apply', { changes: [slow] });
  await kit.waitForEvent('build.start', data => data.revision === 2);
  await kit.request('project.configure', { config });
  await kit.waitForEvent('build.done', data => data.revision === 3);
  await page.waitForTimeout(1200);
  expect((await kit.events('build.done')).map(item => item.data.revision))
    .toEqual([1, 3]);

  // open, with files that do not slow the build down
  await kit.request('fs.apply', { changes: [] });
  await kit.waitForEvent('build.start', data => data.revision === 4);
  await kit.request('project.open', { files, config });
  await kit.waitForEvent(
    'build.done',
    data => data.revision === 1 && data.buildId > 1,
  );
  await page.waitForTimeout(1200);
  expect((await kit.events('build.done')).map(item => item.data.revision))
    .toEqual([1, 3, 1]);

  // close
  await kit.request('fs.apply', { changes: [slow] });
  await kit.waitForEvent('build.start', data => data.revision === 2);
  expect(await kit.request('project.close')).toBeUndefined();
  await expect(kit.card).toHaveCount(0);
  await page.waitForTimeout(1200);
  expect(await kit.events('build.done')).toHaveLength(3);
  expect(await kit.requestError('fs.list')).toBe('NOT_OPEN');
  // Closing again is not an error.
  expect(await kit.request('project.close')).toBeUndefined();

  // A closed project can be opened again.
  await kit.request('project.open', { files, config });
  await kit.waitForEvents('build.done', 4);
  await expect(kit.card.locator('#title')).toHaveText('Main card');
});

test('keeps the hot-update files of the last five builds and two card copies', async ({ page }) => {
  const { kit } = await openSample(page);
  await kit.waitForEvents('preview.load', 1);
  const url = await cardUrl(kit);
  const publicPath = url.slice(0, url.indexOf('.cards/'));
  for (let i = 0; i < 6; i++) {
    await rebuild(kit, []);
  }
  const builds = await kit.events('build.done');
  expect(builds).toHaveLength(7);
  const status = (name: string) =>
    page.evaluate(
      async url => (await fetch(url)).status,
      new URL(name, publicPath).href,
    );
  const hotUpdates = builds.map(item =>
    `main.${item.data.hash}.hot-update.json`
  );
  await expect.poll(async () => Promise.all(hotUpdates.map(status))).toEqual([
    404,
    404,
    200,
    200,
    200,
    200,
    200,
  ]);
  expect(
    await Promise.all(
      [1, 5, 6, 7].map(id => status(`.cards/${id}/main.web.bundle`)),
    ),
  ).toEqual([404, 404, 200, 200]);
  expect(await status('main.web.bundle')).toBe(200);
  expect(await status('nope.js')).toBe(404);

  // The Service Worker answers only for instances that exist.
  const scope = `${servers.kitOrigin}/__lynx_preview__/`;
  expect(
    await Promise.all(
      [`${scope}nope/main.web.bundle`, `${scope}nope/`, scope].map(target =>
        page.evaluate(async url => (await fetch(url)).status, target)
      ),
    ),
  ).toEqual([404, 404, 404]);
});

test('a page that is gone loses its cache', async ({ page }) => {
  const { kit } = await openSample(page);
  await kit.waitForEvents('preview.load', 1);
  const caches = () =>
    page.evaluate(async () =>
      (await globalThis.caches.keys()).filter(name =>
        name.startsWith('lynx-preview:')
      )
    );
  const [first] = await caches();
  expect(first).toBeTruthy();
  await page.reload();
  await page.evaluate(() => window.kit.ready);
  await expect.poll(caches).not.toContain(first);
});

test('a dedicated module worker gets a synchronous XHR answered by the Service Worker', async ({ page }) => {
  await openKit(page, servers);
  const result = await page.evaluate(async () => {
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
