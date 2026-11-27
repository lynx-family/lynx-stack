// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// The tests of this file share one page and one opened project, because
// starting the bundler takes a few seconds. They run in order.

import type { Page } from '@playwright/test';

import { expect, saveCoverage, startCoverage, test } from './coverage.js';
import { kitApi, loadKit, sampleProject } from './harness.js';
import type { Kit } from './harness.js';

test.describe.configure({ mode: 'serial', timeout: 120_000 });

let page: Page;
let kit: Kit;
let files: Record<string, string>;
let config: { entries: Record<string, string> };

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  await startCoverage(page);
  await loadKit(page);
  await page.evaluate(() => window.kit.connect());
  kit = kitApi(page);
  ({ files, config } = await sampleProject());
});

test.afterAll(async () => {
  await saveCoverage(page, 'preview');
  await page.close();
});

/** Replaces `from` with `to` in a file, and waits for the build. */
async function edit(path: string, from: string, to: string) {
  expect(files[path]).toContain(from);
  files[path] = files[path]!.replace(from, to);
  return write(path, files[path]);
}

/** Writes a file, and waits for the build. */
async function write(path: string, content: string) {
  const { revision } = await kit.request('fs.apply', {
    changes: [{ type: 'write', path, content }],
  });
  return kit.waitForEvent('build.done', data => data.revision === revision);
}

async function loads() {
  return (await kit.events('preview.load')).length;
}

test('project.open renders the first card and reports the build', async () => {
  expect(await kit.request('project.open', { files, config })).toEqual({
    revision: 1,
  });
  const done = await kit.waitForEvent('build.done');
  expect(done).toMatchObject({ buildId: 1, revision: 1, success: true });
  expect(done.cards.map(card => card.bundle).sort()).toEqual([
    'detail.web.bundle',
    'main.web.bundle',
  ]);
  expect(await kit.events('build.start')).toEqual([
    { buildId: 1, revision: 1 },
  ]);
  expect(await kit.waitForEvent('preview.load')).toEqual({
    card: 'main',
    hash: done.hash,
    reason: 'open',
  });
  await expect(kit.card.locator('#title')).toHaveText('Main card');
  await expect(kit.card.locator('.page')).toHaveCSS(
    'background-color',
    'rgb(255, 0, 0)',
  );
});

test('a CSS edit and a TSX edit are hot updates that keep the card\'s state', async () => {
  await kit.card.evaluate(view => view.setAttribute('data-marker', 'kept'));
  await kit.card.locator('.page').click();
  await expect(kit.card.locator('#count')).toHaveText('count:1');

  const css = await edit('src/main.css', 'rgb(255, 0, 0)', 'rgb(0, 128, 0)');
  expect(await kit.waitForEvent('preview.hmr', data => data.hash === css.hash))
    .toEqual({ card: 'main', hash: css.hash });
  await expect(kit.card.locator('.page')).toHaveCSS(
    'background-color',
    'rgb(0, 128, 0)',
  );

  const tsx = await edit('src/MainCard.tsx', 'Main card', 'Main card v2');
  await kit.waitForEvent('preview.hmr', data => data.hash === tsx.hash);
  await expect(kit.card.locator('#title')).toHaveText('Main card v2');
  await expect(kit.card.locator('#count')).toHaveText('count:1');
  await expect(kit.card).toHaveAttribute('data-marker', 'kept');
  expect(await loads()).toBe(1);
});

test('an update the card cannot apply reloads it', async () => {
  // `greeting.ts` declines hot updates.
  const done = await edit('src/greeting.ts', '\'Hello\'', '\'Bonjour\'');
  await kit.waitForEvent('preview.hmr', data => data.hash === done.hash);
  expect(
    await kit.waitForEvent('preview.load', data => data.hash === done.hash),
  ).toEqual({ card: 'main', hash: done.hash, reason: 'hmr-fallback' });
  await expect(kit.card.locator('#greeting')).toHaveText('Bonjour');
  await expect(kit.card).not.toHaveAttribute('data-marker', 'kept');
});

test('a failed build leaves the card alone, and the fix reloads it', async () => {
  const good = (await kit.events('build.done')).at(-1)!;
  const before = await loads();
  await kit.card.evaluate(view => view.setAttribute('data-marker', 'kept'));
  const failed = await write(
    'src/MainCard.tsx',
    files['src/MainCard.tsx']!.replace('Main card', 'Main card broken')
      .replace(
        'from \'./greeting\';',
        'from \'./greeting\';\nimport \'./missing\';',
      ),
  );
  expect(failed).toMatchObject({ success: false, cards: [] });
  expect(failed.errors[0]!.message).toContain('Can\'t resolve \'./missing\'');
  await page.waitForTimeout(500);
  expect(await loads()).toBe(before);
  expect(await kit.events('preview.hmr')).not.toContainEqual(
    expect.objectContaining({ hash: failed.hash }),
  );
  await expect(kit.card).toHaveAttribute('data-marker', 'kept');

  // A reload loads the latest successful build, although the failed build
  // rewrote the card bundles.
  await kit.request('preview.reload');
  expect(
    await kit.waitForEvent('preview.load', data => data.reason === 'reload'),
  ).toEqual({ card: 'main', hash: good.hash, reason: 'reload' });
  await expect(kit.card.locator('#title')).toHaveText('Main card v2');
  await expect(kit.card).not.toHaveAttribute('data-marker', 'kept');

  const fixed = await edit('src/MainCard.tsx', 'Main card v2', 'Main card v3');
  expect(fixed.success).toBe(true);
  expect(
    await kit.waitForEvent('preview.load', data => data.hash === fixed.hash),
  ).toEqual({ card: 'main', hash: fixed.hash, reason: 'hmr-fallback' });
  await expect(kit.card.locator('#title')).toHaveText('Main card v3');
});

test('preview.select, preview.reload and preview.setData', async () => {
  const hash = (await kit.events('build.done')).at(-1)!.hash;
  expect(await kit.request('preview.select', { card: 'detail' })).toEqual({
    card: 'detail',
  });
  expect(
    await kit.waitForEvent('preview.load', data => data.reason === 'select'),
  ).toEqual({ card: 'detail', hash, reason: 'select' });
  await expect(kit.card.locator('#title')).toHaveText('Detail card');
  await kit.request('preview.select', { card: 'main' });
  await expect(kit.card.locator('#title')).toHaveText('Main card v3');

  await kit.request('preview.setData', {
    initData: { greeting: 'hi' },
    globalProps: { theme: 'dark' },
  });
  await expect(kit.card.locator('#init-data')).toHaveText('{"greeting":"hi"}');
  await expect(kit.card.locator('#global-props')).toHaveText(
    '{"theme":"dark"}',
  );

  // A reload is a new card, with the data.
  await kit.card.evaluate(view => view.setAttribute('data-marker', 'old'));
  const before = await loads();
  await kit.request('preview.reload');
  expect((await kit.events('preview.load'))[before]).toEqual({
    card: 'main',
    hash,
    reason: 'reload',
  });
  await expect(kit.card).not.toHaveAttribute('data-marker', 'old');
  await expect(kit.card.locator('#init-data')).toHaveText('{"greeting":"hi"}');
  await expect(kit.card.locator('#global-props')).toHaveText(
    '{"theme":"dark"}',
  );
});

test('project.configure adds an entry', async () => {
  await write(
    'src/extra.tsx',
    'import { root } from \'@lynx-js/react\';\n\nroot.render(<view><text id=\'title\'>Extra card</text></view>);\n',
  );
  const { revision } = await kit.request('project.configure', {
    config: { entries: { ...config.entries, extra: 'src/extra.tsx' } },
  });
  const done = await kit.waitForEvent(
    'build.done',
    data => data.revision === revision,
  );
  expect(done.cards.map(card => card.name).sort()).toEqual([
    'detail',
    'extra',
    'main',
  ]);
  expect(
    await kit.waitForEvent('preview.load', data => data.hash === done.hash),
  ).toEqual({ card: 'main', hash: done.hash, reason: 'open' });
  await kit.request('preview.select', { card: 'extra' });
  await expect(kit.card.locator('#title')).toHaveText('Extra card');
});

test('fs.read, fs.list and build.getAsset', async () => {
  expect(await kit.request('fs.list')).toEqual({
    files: [...Object.keys(files), 'src/extra.tsx'].sort(),
  });
  expect(await kit.request('fs.read', { path: 'src/main.css' })).toEqual({
    content: files['src/main.css'],
  });
  const done = (await kit.events('build.done')).at(-1)!;
  const sizes = await page.evaluate(async () => {
    const read = await window.kit.request('fs.read', {
      path: 'src/main.css',
      encoding: 'binary',
    });
    const asset = await window.kit.request('build.getAsset', {
      name: 'main.web.bundle',
    });
    return [read, asset].map(response =>
      (response as { result: { content: Uint8Array } }).result.content
        .byteLength
    );
  });
  expect(sizes).toEqual([
    files['src/main.css']!.length,
    done.assets.find(asset => asset.name === 'main.web.bundle')!.size,
  ]);
});

test('a request that fails answers with an error message', async () => {
  expect(
    await kit.respond('fs.apply', {
      changes: [{ type: 'rename', from: 'src/none.ts', to: 'src/b.ts' }],
    }),
  ).toEqual({
    id: expect.any(Number),
    error: { message: 'Cannot rename "src/none.ts": it does not exist' },
  });
});

test('project.close removes the card', async () => {
  await kit.request('project.close');
  await expect(kit.card).toHaveCount(0);
});
