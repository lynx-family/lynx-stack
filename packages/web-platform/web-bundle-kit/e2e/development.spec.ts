// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// A development watch of the fixture with hot updates, in one page and one
// bundler: the first build, the rendered dev card, CSS and TSX edits whose hot
// updates the card applies, a syntax error and its fix, and the project's own
// `node_modules`.
//
// The steps share the bundler, its rebuilds and the rendered card, so they are
// steps of one test. A check that later steps depend on (a build succeeds,
// the card renders) stops the test. A check that later steps do not depend on
// is soft (`expect.soft`), so that its failure does not hide the next steps.

import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { BuildResult } from '../src/types.js';
import {
  PUBLIC_PATH,
  bytes,
  entries,
  expect,
  fixtureDir,
  fixtureSource,
  readFixture,
  test,
  text,
} from './harness.js';
import type { KitPage, Wire, WireResult } from './harness.js';
import { buildInNode } from './node-build.js';

/**
 * Names shaped `__name__` in the JavaScript of a set of files: the names
 * bundlers and runtimes use (`__webpack_require__`,
 * `__nested_rspack_require_<n>_<m>__`, ...).
 */
function dunderNames(texts: string[]): Set<string> {
  const names = new Set<string>();
  for (const content of texts) {
    for (const name of content.match(/\b__[\w$]+__\b/g) ?? []) {
      names.add(name);
    }
  }
  return names;
}

/** The text and the color of the fixture's title in the rendered card. */
interface Title {
  text: string;
  color?: string;
}

/** Whether the rendered card shows `title`. Runs in the page. */
function titleIs({ text, color }: Title): boolean {
  const root = document.querySelector('lynx-view')?.shadowRoot;
  if (!root) return false;
  const el = [...root.querySelectorAll('*')].find(e =>
    e.children.length === 0 && e.textContent?.trim() === text
  );
  if (!el) return false;
  const owner = el.closest('x-text') ?? el.parentElement ?? el;
  return color === undefined || getComputedStyle(owner).color === color;
}

const hotFiles = (result: WireResult) =>
  result.emitted.map(a => a.name).filter(n => n.includes('hot-update'));

function watchHelpers({ kit, page, consoleLines, requested }: KitPage) {
  return {
    /** Waits for `count` builds, then checks that nothing else follows. */
    async waitForDone(count: number) {
      await page.waitForFunction(
        n => window.kitEvents.filter(e => e.type === 'done').length >= n,
        count,
        { timeout: 120_000 },
      );
      // Nothing else may follow within a short while.
      await page.waitForTimeout(500);
    },
    /** The result of the latest build. */
    async lastDone(): Promise<WireResult> {
      const done = (await kit('events')).filter((
        e,
      ): e is Wire<{ type: 'done'; result: BuildResult }> => e.type === 'done');
      const last = done.at(-1);
      if (!last) throw new Error('no build is done');
      return last.result;
    },
    /** The numbers of `start` and `done` events so far. */
    async countEvents() {
      const events = await page.evaluate(() =>
        window.kitEvents.map(e => e.type)
      );
      return {
        start: events.filter(t => t === 'start').length,
        done: events.filter(t => t === 'done').length,
      };
    },
    /**
     * Sends the rendered dev card the signals of a dev server for `hash`,
     * waits until the card shows `title`, and checks that the HMR client
     * neither failed nor asked for a reload. `label` names the update in
     * failure messages.
     */
    async hotUpdate(label: string, hash: string, title: Title) {
      const before = consoleLines.length;
      const requestedBefore = requested.length;
      await page.evaluate(h => window.hotUpdate(h), hash);
      const failure = await page.waitForFunction(titleIs, title, {
        timeout: 30_000,
      }).then(() => undefined, (error: unknown) => String(error));
      if (failure !== undefined) {
        const events = await page.evaluate(() => window.cardEvents);
        expect.soft(
          failure,
          `the ${label} hot update is applied\ncard events: ${
            JSON.stringify(events)
          }\nrequested: ${
            requested.slice(requestedBefore).join(', ')
          }\nconsole: ${consoleLines.slice(before).join('\n').slice(0, 2000)}`,
        ).toBeUndefined();
      }
      await page.waitForTimeout(500);
      const events = await page.evaluate(() => window.cardEvents);
      expect.soft(events, `${label}: no reload request and no error`).toEqual(
        [],
      );
      const thrown = consoleLines.slice(before).filter(line =>
        /is not defined|\[HMR\].*(fail|abort)|pageerror/i.test(line)
      );
      expect.soft(thrown, `${label}: no error in the console`).toEqual([]);
    },
  };
}

test('development watch() with hot updates', async ({ kitPage }) => {
  // Two failed hot updates wait 30 s each.
  test.setTimeout(240_000);
  const { kit, page, serve, requested, timing } = kitPage;
  const { waitForDone, lastDone, countEvents, hotUpdate } = watchHelpers(
    kitPage,
  );

  await test.step('development watch() with hmr: first build', async () => {
    await kit('create', {
      entries,
      publicPath: PUBLIC_PATH,
      mode: 'development',
      hmr: true,
      files: readFixture(),
    });
    await page.evaluate(() => {
      window.kitEvents = [];
    });
    const start = Date.now();
    await kit('watch');
    await waitForDone(1);
    timing('development first build', Date.now() - start);
    const result = await lastDone();
    timing('development first build in Rspack', result.durationMs);
    expect(result.errors, JSON.stringify(result.errors, null, 2)).toEqual([]);
    expect(await countEvents()).toEqual({ start: 1, done: 1 });
    expect(result.cards).toHaveLength(2);
    serve(result);
    const main = result.emitted.find(a => a.name === 'main.web.bundle');
    expect(main, 'main.web.bundle is emitted').toBeDefined();
    const bundle = bytes(main!.content).toString('latin1');
    expect.soft(
      bundle.includes('LynxTransportClient') || bundle.includes('getDevtool'),
      'HMR client uses lynx.getDevtool()',
    ).toBe(true);
    expect.soft(
      bundle.includes('new WebSocket('),
      'no WebSocket in the dev bundle',
    ).toBe(false);
    // Runtime code the plugins inject by stringifying functions must reach the
    // card as published, not as the kit's own bundling rewrote it (see
    // `STRINGIFIED` in rsbuild.config.ts): the cards must use the same
    // `__name__` identifiers as the same project built in Node.js.
    const nodeOut = mkdtempSync(path.join(os.tmpdir(), 'web-bundle-kit-e2e-'));
    let reference: Set<string>;
    try {
      await buildInNode({
        root: fixtureDir,
        entries,
        outDir: nodeOut,
        publicPath: PUBLIC_PATH,
        mode: 'development',
        hmr: true,
      });
      reference = dunderNames(
        ['main.web.bundle', 'detail.web.bundle'].map(name =>
          readFileSync(path.join(nodeOut, name), 'latin1')
        ),
      );
    } finally {
      rmSync(nodeOut, { recursive: true, force: true });
    }
    const names = dunderNames(
      result.emitted.filter(a => a.name.endsWith('.web.bundle')).map(a =>
        bytes(a.content).toString('latin1')
      ),
    );
    expect.soft(
      {
        onlyInKit: [...names].filter(n => !reference.has(n)),
        onlyInNode: [...reference].filter(n => !names.has(n)),
      },
      'the cards use the identifiers of a Node.js build',
    ).toEqual({ onlyInKit: [], onlyInNode: [] });
  });

  await test.step('dev bundle starts without a WebSocket', async () => {
    const sockets: string[] = [];
    page.on('websocket', ws => sockets.push(ws.url()));
    const requestedBefore = requested.length;
    // <lynx-view> caches templates by URL: a new URL, or it renders the
    // production bundle again.
    await page.evaluate(
      url => window.render(url),
      `${PUBLIC_PATH}main.web.bundle?development`,
    );
    await page.waitForFunction(
      () => {
        const root = document.querySelector('lynx-view')?.shadowRoot;
        return root
          && [...root.querySelectorAll('*')].some(el =>
            el.textContent?.trim() === 'Hello from the web bundle kit'
          );
      },
      null,
      { timeout: 30_000 },
    );
    expect.soft(sockets).toEqual([]);
    expect.soft(
      requested.slice(requestedBefore),
      'the development bundle is loaded',
    ).toContain('main.web.bundle?development');
  });

  let cssResult: WireResult | undefined;
  await test.step('CSS edit: one rebuild with hot updates', async () => {
    const before = await countEvents();
    const start = Date.now();
    await kit('applyChanges', [{
      type: 'write',
      path: 'src/main/App.css',
      content: fixtureSource('src/main/App.css').replace(
        'rgb(255, 0, 0)',
        'rgb(0, 0, 255)',
      ),
    }]);
    await waitForDone(before.done + 1);
    timing('CSS rebuild', Date.now() - start);
    const result = await lastDone();
    timing('CSS rebuild in Rspack', result.durationMs);
    expect(await countEvents()).toEqual({
      start: before.start + 1,
      done: before.done + 1,
    });
    expect(result.errors).toEqual([]);
    const hot = hotFiles(result);
    expect(
      hot.some(n =>
        n.endsWith('.hot-update.json') && !n.endsWith('.css.hot-update.json')
      ),
      `manifest: ${hot.join(', ')}`,
    ).toBe(true);
    expect(
      hot.some(n => n.endsWith('.hot-update.js')),
      `chunk: ${hot.join(', ')}`,
    ).toBe(true);
    expect(
      hot.some(n => n.endsWith('.css.hot-update.json')),
      `css: ${hot.join(', ')}`,
    ).toBe(true);
    expect(
      text(result, n => n.endsWith('.css.hot-update.json')).length,
    ).toBeGreaterThan(0);
    serve(result);
    cssResult = result;
  });

  await test.step('CSS hot update is applied in the dev card', async () => {
    await hotUpdate('CSS', cssResult!.hash, {
      text: 'Hello from the web bundle kit',
      color: 'rgb(0, 0, 255)',
    });
  });

  let tsxResult: WireResult | undefined;
  await test.step('TSX edit: one rebuild with hot updates', async () => {
    const before = await countEvents();
    const start = Date.now();
    await kit('applyChanges', [{
      type: 'write',
      path: 'src/main/App.tsx',
      content: fixtureSource('src/main/App.tsx').replace(
        'Hello from the web bundle kit',
        'Hello again',
      ),
    }]);
    await waitForDone(before.done + 1);
    timing('TSX rebuild', Date.now() - start);
    const result = await lastDone();
    timing('TSX rebuild in Rspack', result.durationMs);
    expect(await countEvents()).toEqual({
      start: before.start + 1,
      done: before.done + 1,
    });
    expect(result.errors).toEqual([]);
    const hot = hotFiles(result);
    expect(
      hot.some(n => n.endsWith('.hot-update.json')),
      `manifest: ${hot.join(', ')}`,
    ).toBe(true);
    expect(
      hot.some(n => n.endsWith('.hot-update.js')),
      `chunk: ${hot.join(', ')}`,
    ).toBe(true);
    expect(
      text(result, n => n.endsWith('.hot-update.js')).includes('Hello again'),
      'the hot update has the new text',
    ).toBe(true);
    serve(result);
    tsxResult = result;
  });

  await test.step('TSX hot update is applied in the dev card', async () => {
    await hotUpdate('TSX', tsxResult!.hash, {
      text: 'Hello again',
      color: 'rgb(0, 0, 255)',
    });
  });

  await test.step(
    'syntax error reports file/line, next good edit recovers',
    async () => {
      let before = await countEvents();
      await kit('applyChanges', [{
        type: 'write',
        path: 'src/main/App.tsx',
        content: 'export function App() {\n  return <view>\n}\n',
      }]);
      await waitForDone(before.done + 1);
      expect(await countEvents()).toEqual({
        start: before.start + 1,
        done: before.done + 1,
      });
      const failed = await lastDone();
      expect(failed.errors.length).toBeGreaterThan(0);
      expect(failed.cards).toEqual([]);
      const located = failed.errors.find(e =>
        e.file === 'src/main/App.tsx' && typeof e.line === 'number'
      );
      expect(
        located,
        JSON.stringify(
          failed.errors.map(({ file, line, column, message }) => ({
            file,
            line,
            column,
            message: message.slice(0, 300),
          })),
          null,
          2,
        ),
      ).toBeDefined();

      before = await countEvents();
      await kit('applyChanges', [{
        type: 'write',
        path: 'src/main/App.tsx',
        content: fixtureSource('src/main/App.tsx').replace(
          'Hello from the web bundle kit',
          'Recovered',
        ),
      }]);
      await waitForDone(before.done + 1);
      expect(await countEvents()).toEqual({
        start: before.start + 1,
        done: before.done + 1,
      });
      const recovered = await lastDone();
      expect(recovered.errors).toEqual([]);
      expect(recovered.cards).toHaveLength(2);
      serve(recovered);
    },
  );

  await test.step('project node_modules wins over the kit\'s mirror', async () => {
    const before = await countEvents();
    await kit('applyChanges', [
      {
        type: 'write',
        path: 'node_modules/tiny-invariant/package.json',
        content: JSON.stringify({
          name: 'tiny-invariant',
          version: '9.9.9',
          main: 'index.js',
        }),
      },
      {
        type: 'write',
        path: 'node_modules/tiny-invariant/index.js',
        content:
          'module.exports = function invariant() { return "from the project node_modules"; };\n',
      },
      {
        type: 'write',
        path: 'src/main/App.tsx',
        content: `import invariant from 'tiny-invariant';\n${
          fixtureSource('src/main/App.tsx').replace(
            '\'Hello from the web bundle kit\'',
            'invariant()',
          ).replace('Hello from the web bundle kit', '{invariant()}')
        }`,
      },
    ]);
    await waitForDone(before.done + 1);
    expect(await countEvents()).toEqual({
      start: before.start + 1,
      done: before.done + 1,
    });
    const result = await lastDone();
    expect.soft(result.errors, JSON.stringify(result.errors, null, 2)).toEqual(
      [],
    );
    expect.soft(
      text(result, n => n.endsWith('.js') || n.endsWith('.bundle')).includes(
        'from the project node_modules',
      ),
      'the build contains the project copy of tiny-invariant',
    ).toBe(true);
    expect.soft(await kit('listFiles')).toContain(
      'node_modules/tiny-invariant/index.js',
    );
  });

  await test.step('close()', async () => {
    await kit('close');
  });
});
