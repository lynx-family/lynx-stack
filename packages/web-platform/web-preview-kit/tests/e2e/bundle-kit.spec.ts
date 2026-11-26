// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// The whole kit as shipped: the demo host drives the protocol, the kit's own
// bundler worker builds with the copy of `@lynx-js/web-bundle-kit` in
// `dist/kit/bundle-kit`, nothing is substituted.

import { existsSync } from 'node:fs';
import path from 'node:path';

import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { openDemo, start } from './harness.js';
import type { Servers } from './harness.js';
import { packageDir } from './paths.js';

test.skip(
  !existsSync(path.join(packageDir, 'dist/kit/bundle-kit/index.js')),
  'the kit was built without @lynx-js/web-bundle-kit',
);
test.describe.configure({ timeout: 180_000 });

let servers: Servers;

test.beforeAll(async () => {
  servers = await start({});
});

test.afterAll(async () => {
  await servers.close();
});

type Demo = Awaited<ReturnType<typeof openDemo>>;

async function apply(demo: Demo, changes: { path: string; content: string }[]) {
  const { revision } = await demo.request('fs.apply', {
    changes: changes.map(change => ({ type: 'write', ...change })),
  });
  const done = await demo.waitForEvent(
    'build.done',
    data => data.revision >= revision,
  );
  return { revision, done };
}

async function sample(page: Page) {
  return {
    files: await page.evaluate(() => window.demo.sampleFiles),
    config: await page.evaluate(() => window.demo.sampleConfig),
  };
}

test('develops a project through the real bundle kit', async ({ page }) => {
  const demo = await openDemo(page, servers, { dip: true });
  expect(demo.hello.supported).toBe(true);
  expect(demo.hello.builtinPackages).toHaveProperty('@lynx-js/react');
  const { files, config } = await sample(page);
  const source = (name: string) => String(files[name]);

  // Open: the first build loads the first card.
  expect(await demo.request('project.open', { files, config })).toEqual({
    revision: 1,
  });
  const first = await demo.waitForEvent('build.done', () => true);
  expect(first).toMatchObject({ buildId: 1, revision: 1, success: true });
  expect(first.cards.map(card => card.bundle).sort()).toEqual([
    'detail.web.bundle',
    'main.web.bundle',
  ]);
  expect(await demo.waitForEvent('preview.load', () => true)).toEqual({
    card: 'main',
    hash: first.hash,
    reason: 'open',
  });
  await expect(demo.card.locator('#title')).toHaveText('Main card');
  await expect(demo.card.locator('.page')).toHaveCSS(
    'background-color',
    'rgb(255, 0, 0)',
  );
  await demo.card.evaluate(view => view.setAttribute('data-marker', 'kept'));
  await demo.card.locator('.page').click();
  await expect(demo.card.locator('#count')).toHaveText('count:1');

  // A CSS edit restyles the card without a reload.
  const css = await apply(demo, [{
    path: 'src/main.css',
    content: source('src/main.css').replace('rgb(255, 0, 0)', 'rgb(0, 128, 0)'),
  }]);
  expect(css.done.success).toBe(true);
  await demo.waitForEvent('preview.hmr', data => data.hash === css.done.hash);
  await expect(demo.card.locator('.page')).toHaveCSS(
    'background-color',
    'rgb(0, 128, 0)',
  );

  // A TSX edit updates the card through HMR, keeping its state.
  const tsx = await apply(demo, [{
    path: 'src/MainCard.tsx',
    content: source('src/MainCard.tsx').replace('Main card', 'Main card v2'),
  }]);
  await demo.waitForEvent('preview.hmr', data => data.hash === tsx.done.hash);
  await expect(demo.card.locator('#title')).toHaveText('Main card v2');
  await expect(demo.card.locator('#count')).toHaveText('count:1');
  await expect(demo.card).toHaveAttribute('data-marker', 'kept');

  // A syntax error: diagnostics, and the card is left alone.
  const broken = await apply(demo, [{
    path: 'src/MainCard.tsx',
    content: source('src/MainCard.tsx').replace('return (', 'return ((('),
  }]);
  expect(broken.done).toMatchObject({ success: false, cards: [] });
  expect(broken.done.errors.length).toBeGreaterThan(0);
  expect(broken.done.errors[0]).toMatchObject({ file: 'src/MainCard.tsx' });
  await page.waitForTimeout(500);
  expect(
    (await demo.events('preview.hmr')).filter(item =>
      item.data.hash === broken.done.hash
    ),
  ).toEqual([]);
  expect(await demo.events('preview.load')).toHaveLength(1);
  await expect(demo.card).toHaveAttribute('data-marker', 'kept');
  await expect(demo.card.locator('#title')).toHaveText('Main card v2');

  // The next good edit recovers: the first success after a failed build
  // loads the card again (see Session), with the fixed content.
  const fixed = await apply(demo, [
    {
      path: 'src/MainCard.tsx',
      content: source('src/MainCard.tsx').replace('Main card', 'Main card v3'),
    },
    {
      path: 'src/main.css',
      content: source('src/main.css').replace(
        'rgb(255, 0, 0)',
        'rgb(0, 0, 128)',
      ),
    },
  ]);
  expect(fixed.done.success).toBe(true);
  expect(
    await demo.waitForEvent(
      'preview.load',
      data => data.hash === fixed.done.hash,
    ),
  ).toEqual({ card: 'main', hash: fixed.done.hash, reason: 'hmr-fallback' });
  await expect(demo.card.locator('#title')).toHaveText('Main card v3');
  await expect(demo.card.locator('.page')).toHaveCSS(
    'background-color',
    'rgb(0, 0, 128)',
  );
  await expect(demo.card).not.toHaveAttribute('data-marker', 'kept');
  expect(await demo.events('preview.error')).toEqual([]);

  // Another card, at its latest build.
  const detail = await apply(demo, [{
    path: 'src/detail.tsx',
    content: source('src/detail.tsx').replace('Detail card', 'Detail card v2'),
  }]);
  await demo.request('preview.select', { card: 'detail' });
  expect(
    await demo.waitForEvent('preview.load', data => data.reason === 'select'),
  ).toEqual({ card: 'detail', hash: detail.done.hash, reason: 'select' });
  await expect(demo.card.locator('#title')).toHaveText('Detail card v2');

  // A third entry, added with project.configure.
  await demo.request('fs.apply', {
    changes: [{
      type: 'write',
      path: 'src/extra.tsx',
      content: [
        'import { root } from \'@lynx-js/react\';',
        '',
        'root.render(<view><text id=\'title\'>Extra card</text></view>);',
        '',
      ].join('\n'),
    }],
  });
  const { revision } = await demo.request('project.configure', {
    config: {
      entries: { ...config.entries, extra: 'src/extra.tsx' },
    },
  });
  const configured = await demo.waitForEvent(
    'build.done',
    data => data.revision === revision,
  );
  expect(configured.success).toBe(true);
  expect(configured.cards.map(card => card.name).sort()).toEqual([
    'detail',
    'extra',
    'main',
  ]);
  // The previewed card is still an entry, so it opens again.
  await demo.waitForEvent(
    'preview.load',
    data => data.reason === 'open' && data.hash === configured.hash,
  );
  await expect(demo.card.locator('#title')).toHaveText('Detail card v2');
  await demo.request('preview.select', { card: 'extra' });
  await expect(demo.card.locator('#title')).toHaveText('Extra card');
  expect(await demo.request('fs.list')).toEqual({
    files: [...Object.keys(files), 'src/extra.tsx'].sort(),
  });
});

test('builds a production project', async ({ page }) => {
  const demo = await openDemo(page, servers, { isolated: true, dip: false });
  expect(demo.hello.supported).toBe(true);
  const { files, config } = await sample(page);
  await demo.request('project.open', {
    files,
    config: { ...config, mode: 'production' },
    card: 'detail',
  });
  const done = await demo.waitForEvent('build.done', () => true);
  expect(done.success).toBe(true);
  expect(done.assets.some(asset => asset.name.includes('hot-update'))).toBe(
    false,
  );
  await expect(demo.card.locator('#title')).toHaveText('Detail card');
  const size = await page.evaluate(async () => {
    const preview = await window.demo.ready;
    return (await preview.getAsset('main.web.bundle')).byteLength;
  });
  expect(size).toBe(
    done.assets.find(asset => asset.name === 'main.web.bundle')!.size,
  );

  // Without hot updates, a rebuild reloads the card.
  const { revision } = await demo.request('fs.apply', {
    changes: [{
      type: 'write',
      path: 'src/detail.tsx',
      content: String(files['src/detail.tsx']).replace(
        'Detail card',
        'Detail card v2',
      ),
    }],
  });
  const rebuilt = await demo.waitForEvent(
    'build.done',
    data => data.revision === revision,
  );
  expect(
    await demo.waitForEvent('preview.load', data => data.reason === 'rebuild'),
  ).toEqual({ card: 'detail', hash: rebuilt.hash, reason: 'rebuild' });
  await expect(demo.card.locator('#title')).toHaveText('Detail card v2');
});
