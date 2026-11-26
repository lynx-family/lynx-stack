// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// Stage 2: hot updates. By default the bundler worker is replaced by one that
// builds with a real Rsbuild watch compilation in Node, configured as the
// bundle kit configures a project (`tests/node/fixture-config.mjs`). With
// `PREVIEW_KIT_BUNDLER=real` the kit's own worker and the copy of
// `@lynx-js/web-bundle-kit` in `dist/kit/bundle-kit` build in the browser.

import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

// @ts-expect-error plain JavaScript without types
import { createDevService } from '../node/dev-service.mjs';
import { openDemo, start } from './harness.js';
import type { Servers } from './harness.js';
import { packageDir, workersDir } from './paths.js';

const useRealBundler = process.env['PREVIEW_KIT_BUNDLER'] === 'real';

let servers: Servers;
let service: { route: never; close(): Promise<void> } | undefined;
let workDir: string | undefined;

test.beforeEach(async () => {
  if (useRealBundler) {
    servers = await start({});
    return;
  }
  workDir = await mkdtemp(path.join(os.tmpdir(), 'web-preview-kit-'));
  service = createDevService({
    workDir,
    nodeModules: path.join(packageDir, 'node_modules'),
  });
  servers = await start({
    kitOverrides: {
      '/bundler-worker.js': path.join(workersDir, 'dev-worker.js'),
    },
    kitRoutes: [service!.route],
  });
});

test.afterEach(async () => {
  await servers.close();
  await service?.close();
  if (workDir) {
    await rm(workDir, { recursive: true, force: true });
  }
});

async function openSample(page: Page) {
  const demo = await openDemo(page, servers, { isolated: false, dip: true });
  expect(demo.hello.supported).toBe(true);
  const files = await page.evaluate(() => window.demo.sampleFiles);
  const config = await page.evaluate(() => window.demo.sampleConfig);
  await demo.request('project.open', { files, config });
  await demo.waitForEvents('preview.load', 1);
  await expect(demo.card.locator('#title')).toHaveText('Main card');
  return { demo, files };
}

type Demo = Awaited<ReturnType<typeof openSample>>['demo'];
type Change = { type: 'write'; path: string; content: string };

/** Applies changes and waits for the build of their revision. */
async function applyChanges(demo: Demo, changes: Change[]) {
  const { revision } = await demo.request('fs.apply', { changes });
  const done = await demo.waitForEvent(
    'build.done',
    data => data.revision === revision,
  );
  return { revision, done };
}

function edit(
  files: Record<string, unknown>,
  file: string,
  from: string,
  to: string,
): Change {
  const content = String(files[file]);
  expect(content).toContain(from);
  return { type: 'write', path: file, content: content.replace(from, to) };
}

test('a CSS edit restyles the card without a reload', async ({ page }) => {
  const { demo, files } = await openSample(page);
  await expect(demo.card.locator('.page')).toHaveCSS(
    'background-color',
    'rgb(255, 0, 0)',
  );
  await demo.card.evaluate(view => view.setAttribute('data-marker', 'kept'));

  const { revision, done } = await applyChanges(demo, [
    edit(files, 'src/main.css', 'rgb(255, 0, 0)', 'rgb(0, 128, 0)'),
  ]);
  expect(revision).toBe(2);
  expect(done.success).toBe(true);
  await demo.waitForEvent('preview.hmr', data => data.hash === done.hash);
  await expect(demo.card.locator('.page')).toHaveCSS(
    'background-color',
    'rgb(0, 128, 0)',
  );
  await expect(demo.card).toHaveAttribute('data-marker', 'kept');
  expect(await demo.events('preview.load')).toHaveLength(1);
});

test('a TSX edit updates the text through HMR and keeps state', async ({ page }) => {
  const { demo, files } = await openSample(page);
  await demo.card.evaluate(view => view.setAttribute('data-marker', 'kept'));
  // State that a reload would lose.
  await demo.card.locator('.page').click();
  await expect(demo.card.locator('#count')).toHaveText('count:1');

  const { done } = await applyChanges(demo, [
    edit(files, 'src/MainCard.tsx', 'Main card', 'Main card v2'),
  ]);
  expect(done.success).toBe(true);
  await demo.waitForEvent('preview.hmr', data => data.hash === done.hash);
  await expect(demo.card.locator('#title')).toHaveText('Main card v2');
  await expect(demo.card).toHaveAttribute('data-marker', 'kept');
  await expect(demo.card.locator('#count')).toHaveText('count:1');
  expect(await demo.events('preview.load')).toHaveLength(1);
});

test('a failed build leaves the card alone and reports diagnostics', async ({ page }) => {
  const { demo, files } = await openSample(page);
  await demo.card.evaluate(view => view.setAttribute('data-marker', 'kept'));
  const failed = await applyChanges(demo, [
    edit(files, 'src/MainCard.tsx', 'Main card', 'Main card broken'),
    edit(
      files,
      'src/greeting.ts',
      'export const greeting = \'Hello\';',
      'export const greeting = \'Hello\';\nimport \'./missing\';',
    ),
  ]);
  expect(failed.done).toMatchObject({ success: false, cards: [] });
  expect(failed.done.errors[0]).toMatchObject({ file: 'src/greeting.ts' });
  expect(failed.done.errors[0]!.message).toContain(
    'Can\'t resolve \'./missing\'',
  );
  // Nothing follows a failed build.
  await page.waitForTimeout(500);
  expect(
    (await demo.events('preview.hmr')).filter(item =>
      item.data.hash === failed.done.hash
    ),
  ).toHaveLength(0);
  expect(await demo.events('preview.load')).toHaveLength(1);
  await expect(demo.card).toHaveAttribute('data-marker', 'kept');
  await expect(demo.card.locator('#title')).toHaveText('Main card');

  // A reload loads the latest successful build, not the failed one, although
  // the failed build rewrote the card bundle.
  await demo.request('preview.reload');
  const reload = await demo.waitForEvent(
    'preview.load',
    data => data.reason === 'reload',
  );
  const successes = (await demo.events('build.done')).filter(item =>
    item.data.success
  );
  expect(reload.hash).toBe(successes.at(-1)!.data.hash);
  await expect(demo.card).not.toHaveAttribute('data-marker', 'kept');
  await expect(demo.card.locator('#title')).toHaveText('Main card');
  await expect(demo.card.locator('#greeting')).toHaveText('Hello');
  expect(await demo.events('preview.error')).toHaveLength(0);

  // Fixing it is a successful build again.
  const fixed = await applyChanges(demo, [
    edit(files, 'src/MainCard.tsx', 'Main card', 'Main card fixed'),
    {
      type: 'write',
      path: 'src/greeting.ts',
      content: String(files['src/greeting.ts']),
    },
  ]);
  expect(fixed.done.success).toBe(true);
  // The card was loaded before the fix, so it is loaded again (see the
  // next test).
  await demo.waitForEvent(
    'preview.load',
    data => data.reason === 'hmr-fallback' && data.hash === fixed.done.hash,
  );
  await expect(demo.card.locator('#title')).toHaveText('Main card fixed');
});

// A hot update whose chain passes through a failed compilation leaves the
// main thread of a web card stale (a web HMR bug that also shows with
// `rsbuild dev`), so the first successful build after a failed one loads the
// card again instead.
test('the fix of a failed build reloads the card with the fixed content', async ({ page }) => {
  const { demo, files } = await openSample(page);
  await demo.card.evaluate(view => view.setAttribute('data-marker', 'old'));
  const failed = await applyChanges(demo, [
    edit(
      files,
      'src/MainCard.tsx',
      'from \'./greeting\';',
      'from \'./greeting\';\nimport \'./missing\';',
    ),
  ]);
  expect(failed.done.success).toBe(false);
  await page.waitForTimeout(500);
  await expect(demo.card).toHaveAttribute('data-marker', 'old');
  const fixed = await applyChanges(demo, [
    edit(files, 'src/MainCard.tsx', 'Main card', 'Main card fixed'),
  ]);
  expect(fixed.done.success).toBe(true);
  expect(
    await demo.waitForEvent(
      'preview.load',
      data => data.hash === fixed.done.hash,
    ),
  ).toEqual({ card: 'main', hash: fixed.done.hash, reason: 'hmr-fallback' });
  expect(
    (await demo.events('preview.hmr')).filter(item =>
      item.data.hash === fixed.done.hash
    ),
  ).toEqual([]);
  await expect(demo.card.locator('#title')).toHaveText('Main card fixed');
  await expect(demo.card).not.toHaveAttribute('data-marker', 'old');

  // Later edits are hot updates again.
  await demo.card.evaluate(view => view.setAttribute('data-marker', 'new'));
  const next = await applyChanges(demo, [
    edit(files, 'src/MainCard.tsx', 'Main card', 'Main card next'),
  ]);
  await demo.waitForEvent('preview.hmr', data => data.hash === next.done.hash);
  await expect(demo.card.locator('#title')).toHaveText('Main card next');
  await expect(demo.card).toHaveAttribute('data-marker', 'new');
});

test('an update the card cannot apply reloads it', async ({ page }) => {
  const { demo, files } = await openSample(page);
  await demo.card.evaluate(view => view.setAttribute('data-marker', 'old'));
  await expect(demo.card.locator('#greeting')).toHaveText('Hello');
  const { done } = await applyChanges(demo, [
    edit(files, 'src/greeting.ts', '\'Hello\'', '\'Bonjour\''),
  ]);
  await demo.waitForEvent('preview.hmr', data => data.hash === done.hash);
  const load = await demo.waitForEvent(
    'preview.load',
    data => data.reason === 'hmr-fallback',
  );
  expect(load).toEqual({
    card: 'main',
    hash: done.hash,
    reason: 'hmr-fallback',
  });
  await expect(demo.card.locator('#greeting')).toHaveText('Bonjour');
  await expect(demo.card).not.toHaveAttribute('data-marker', 'old');
});

test('switching cards after edits shows the latest build', async ({ page }) => {
  const { demo, files } = await openSample(page);
  const { done } = await applyChanges(demo, [
    edit(files, 'src/detail.tsx', 'Detail card', 'Detail card v2'),
    edit(files, 'src/detail.css', 'rgb(0, 0, 255)', 'rgb(255, 255, 0)'),
  ]);
  expect(done.success).toBe(true);
  await demo.request('preview.select', { card: 'detail' });
  const load = await demo.waitForEvent(
    'preview.load',
    data => data.reason === 'select',
  );
  expect(load).toEqual({ card: 'detail', hash: done.hash, reason: 'select' });
  await expect(demo.card.locator('#title')).toHaveText('Detail card v2');
  await expect(demo.card.locator('.detail')).toHaveCSS(
    'background-color',
    'rgb(255, 255, 0)',
  );

  // Edits keep hot-updating the selected card.
  await demo.card.evaluate(view => view.setAttribute('data-marker', 'kept'));
  const next = await applyChanges(demo, [
    edit(files, 'src/detail.tsx', 'Detail card', 'Detail card v3'),
  ]);
  const hmr = await demo.waitForEvent(
    'preview.hmr',
    data => data.hash === next.done.hash,
  );
  expect(hmr.card).toBe('detail');
  await expect(demo.card.locator('#title')).toHaveText('Detail card v3');
  await expect(demo.card).toHaveAttribute('data-marker', 'kept');
});
