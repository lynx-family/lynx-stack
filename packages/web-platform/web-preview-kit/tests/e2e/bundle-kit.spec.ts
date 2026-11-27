// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// The whole kit as shipped: the kit's own bundler worker builds with the copy
// of `@lynx-js/web-bundle-kit` in `dist/kit/bundle-kit`, nothing is
// substituted. The test drives the kit as the top-level page.

import { existsSync } from 'node:fs';
import path from 'node:path';

import { expect, test } from './coverage.js';
import { openKit, sampleProject, start } from './harness.js';
import type { Kit, Servers } from './harness.js';
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

async function apply(kit: Kit, changes: { path: string; content: string }[]) {
  const { revision } = await kit.request('fs.apply', {
    changes: changes.map(change => ({ type: 'write', ...change })),
  });
  const done = await kit.waitForEvent(
    'build.done',
    data => data.revision >= revision,
  );
  return { revision, done };
}

test('develops a project through the real bundle kit', async ({ page }) => {
  const kit = await openKit(page, servers);
  expect(kit.hello.supported).toBe(true);
  expect(kit.hello.builtinPackages).toHaveProperty('@lynx-js/react');
  const { files, config } = await sampleProject();
  const source = (name: string) => String(files[name]);

  // Open: the first build loads the first card.
  expect(await kit.request('project.open', { files, config })).toEqual({
    revision: 1,
  });
  const first = await kit.waitForEvent('build.done', () => true);
  expect(first).toMatchObject({ buildId: 1, revision: 1, success: true });
  expect(first.cards.map(card => card.bundle).sort()).toEqual([
    'detail.web.bundle',
    'main.web.bundle',
  ]);
  expect(await kit.waitForEvent('preview.load', () => true)).toEqual({
    card: 'main',
    hash: first.hash,
    reason: 'open',
  });
  await expect(kit.card.locator('#title')).toHaveText('Main card');
  await expect(kit.card.locator('.page')).toHaveCSS(
    'background-color',
    'rgb(255, 0, 0)',
  );
  await kit.card.evaluate(view => view.setAttribute('data-marker', 'kept'));
  await kit.card.locator('.page').click();
  await expect(kit.card.locator('#count')).toHaveText('count:1');

  // A CSS edit restyles the card without a reload.
  const css = await apply(kit, [{
    path: 'src/main.css',
    content: source('src/main.css').replace('rgb(255, 0, 0)', 'rgb(0, 128, 0)'),
  }]);
  expect(css.done.success).toBe(true);
  await kit.waitForEvent('preview.hmr', data => data.hash === css.done.hash);
  await expect(kit.card.locator('.page')).toHaveCSS(
    'background-color',
    'rgb(0, 128, 0)',
  );

  // A TSX edit updates the card through HMR, keeping its state.
  const tsx = await apply(kit, [{
    path: 'src/MainCard.tsx',
    content: source('src/MainCard.tsx').replace('Main card', 'Main card v2'),
  }]);
  await kit.waitForEvent('preview.hmr', data => data.hash === tsx.done.hash);
  await expect(kit.card.locator('#title')).toHaveText('Main card v2');
  await expect(kit.card.locator('#count')).toHaveText('count:1');
  await expect(kit.card).toHaveAttribute('data-marker', 'kept');

  // A syntax error: diagnostics, and the card is left alone.
  const broken = await apply(kit, [{
    path: 'src/MainCard.tsx',
    content: source('src/MainCard.tsx').replace('return (', 'return ((('),
  }]);
  expect(broken.done).toMatchObject({ success: false, cards: [] });
  expect(broken.done.errors.length).toBeGreaterThan(0);
  expect(broken.done.errors[0]).toMatchObject({ file: 'src/MainCard.tsx' });
  await page.waitForTimeout(500);
  expect(
    (await kit.events('preview.hmr')).filter(item =>
      item.data.hash === broken.done.hash
    ),
  ).toEqual([]);
  expect(await kit.events('preview.load')).toHaveLength(1);
  await expect(kit.card).toHaveAttribute('data-marker', 'kept');
  await expect(kit.card.locator('#title')).toHaveText('Main card v2');

  // The next good edit recovers: the first success after a failed build
  // loads the card again (see Session), with the fixed content.
  const fixed = await apply(kit, [
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
    await kit.waitForEvent(
      'preview.load',
      data => data.hash === fixed.done.hash,
    ),
  ).toEqual({ card: 'main', hash: fixed.done.hash, reason: 'hmr-fallback' });
  await expect(kit.card.locator('#title')).toHaveText('Main card v3');
  await expect(kit.card.locator('.page')).toHaveCSS(
    'background-color',
    'rgb(0, 0, 128)',
  );
  await expect(kit.card).not.toHaveAttribute('data-marker', 'kept');
  expect(await kit.events('preview.error')).toEqual([]);

  // Another card, at its latest build.
  const detail = await apply(kit, [{
    path: 'src/detail.tsx',
    content: source('src/detail.tsx').replace('Detail card', 'Detail card v2'),
  }]);
  await kit.request('preview.select', { card: 'detail' });
  expect(
    await kit.waitForEvent('preview.load', data => data.reason === 'select'),
  ).toEqual({ card: 'detail', hash: detail.done.hash, reason: 'select' });
  await expect(kit.card.locator('#title')).toHaveText('Detail card v2');

  // A third entry, added with project.configure.
  await kit.request('fs.apply', {
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
  const { revision } = await kit.request('project.configure', {
    config: {
      entries: { ...config.entries, extra: 'src/extra.tsx' },
    },
  });
  const configured = await kit.waitForEvent(
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
  await kit.waitForEvent(
    'preview.load',
    data => data.reason === 'open' && data.hash === configured.hash,
  );
  await expect(kit.card.locator('#title')).toHaveText('Detail card v2');
  await kit.request('preview.select', { card: 'extra' });
  await expect(kit.card.locator('#title')).toHaveText('Extra card');
  expect(await kit.request('fs.list')).toEqual({
    files: [...Object.keys(files), 'src/extra.tsx'].sort(),
  });

  // Edits that arrive while a build runs are merged into the next build,
  // which carries the newest of their revisions.
  const before = (await kit.events('build.start')).length;
  const extra = (title: string) => ({
    type: 'write' as const,
    path: 'src/extra.tsx',
    content:
      `import { root } from '@lynx-js/react';\n\nroot.render(<view><text id='title'>${title}</text></view>);\n`,
  });
  const revisions = [];
  for (const title of ['Extra 1', 'Extra 2', 'Extra 3']) {
    revisions.push(
      (await kit.request('fs.apply', { changes: [extra(title)] })).revision,
    );
  }
  const last = revisions.at(-1)!;
  const merged = await kit.waitForEvent(
    'build.done',
    data => data.revision === last,
  );
  expect(merged.success).toBe(true);
  const starts = (await kit.events('build.start')).slice(before).map(item =>
    item.data.revision
  );
  expect(starts.at(-1)).toBe(last);
  expect([...starts].sort((a, b) => a - b)).toEqual(starts);
  await kit.waitForEvent('preview.hmr', data => data.hash === merged.hash);
  await expect(kit.card.locator('#title')).toHaveText('Extra 3');

  // File requests reach the bundle kit's file system.
  const bytes = await page.evaluate(async () => {
    const response = await window.kit.request('fs.read', {
      path: 'src/main.css',
      encoding: 'binary',
    });
    return [
      ...(response as { result: { content: Uint8Array } }).result.content,
    ];
  });
  expect(new TextDecoder().decode(new Uint8Array(bytes))).toBe(
    source('src/main.css').replace('rgb(255, 0, 0)', 'rgb(0, 0, 128)'),
  );
  expect(await kit.requestError('fs.read', { path: 'src/none.ts' })).toBe(
    'NOT_FOUND',
  );
  expect(
    await kit.respond('fs.apply', {
      changes: [{ type: 'rename', from: 'src/none.ts', to: 'src/b.ts' }],
    }),
  ).toMatchObject({
    error: {
      code: 'INTERNAL',
      message: 'Cannot rename "src/none.ts": it does not exist',
    },
  });

  // Closing stops the bundler and removes the card.
  await kit.request('project.close');
  await expect(kit.card).toHaveCount(0);
  expect(await kit.requestError('fs.list')).toBe('NOT_OPEN');
});

test('builds a production project', async ({ page }) => {
  const kit = await openKit(page, servers);
  expect(kit.hello.supported).toBe(true);
  const { files, config } = await sampleProject();
  await kit.request('project.open', {
    files,
    config: { ...config, mode: 'production' },
    card: 'detail',
  });
  const done = await kit.waitForEvent('build.done', () => true);
  expect(done.success).toBe(true);
  expect(done.assets.some(asset => asset.name.includes('hot-update'))).toBe(
    false,
  );
  await expect(kit.card.locator('#title')).toHaveText('Detail card');
  const size = await page.evaluate(async () => {
    const response = await window.kit.request('build.getAsset', {
      name: 'main.web.bundle',
    });
    return (response as { result: { content: Uint8Array } }).result.content
      .byteLength;
  });
  expect(size).toBe(
    done.assets.find(asset => asset.name === 'main.web.bundle')!.size,
  );

  // Without hot updates, a rebuild reloads the card.
  const { revision } = await kit.request('fs.apply', {
    changes: [{
      type: 'write',
      path: 'src/detail.tsx',
      content: String(files['src/detail.tsx']).replace(
        'Detail card',
        'Detail card v2',
      ),
    }],
  });
  const rebuilt = await kit.waitForEvent(
    'build.done',
    data => data.revision === revision,
  );
  expect(
    await kit.waitForEvent('preview.load', data => data.reason === 'rebuild'),
  ).toEqual({ card: 'detail', hash: rebuilt.hash, reason: 'rebuild' });
  await expect(kit.card.locator('#title')).toHaveText('Detail card v2');
});
