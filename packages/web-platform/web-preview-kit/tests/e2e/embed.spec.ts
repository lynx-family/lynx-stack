// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// The kit embedded in an iframe on another origin, as a host embeds it: the
// demo host (`demo/main.ts`) connects with the client of `src/client`. This
// is the only spec that runs the client, and the one that checks both ways
// of making the iframe cross-origin isolated. The bundler worker is the
// static test double.

import path from 'node:path';

import { expect, test } from './coverage.js';
import { openDemo, start, staticFixtureRoute } from './harness.js';
import type { Route, Servers } from './harness.js';
import { workersDir } from './paths.js';

/**
 * Pages on the kit origin that are not the kit: `silent.html` never answers,
 * `v2.html` announces protocol version 2 only.
 */
const fakeKitRoute: Route = (_request, response, url) => {
  const pages: Record<string, string> = {
    '/__fake__/silent.html': '<!DOCTYPE html><title>silent</title>',
    '/__fake__/v2.html': `<!DOCTYPE html><title>v2</title><script>
      const ready = { channel: 'lynx-web-preview', type: 'ready', versions: [2] };
      parent.postMessage(ready, '*');
      addEventListener('message', () => parent.postMessage(ready, '*'));
    </script>`,
  };
  const page = pages[url.pathname];
  if (page === undefined) {
    return false;
  }
  response.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'Cross-Origin-Embedder-Policy': 'require-corp',
    'Cross-Origin-Resource-Policy': 'cross-origin',
  }).end(page);
  return true;
};

let servers: Servers;

test.beforeAll(async () => {
  servers = await start({
    kitOverrides: {
      '/bundler-worker.js': path.join(workersDir, 'static-worker.js'),
    },
    kitRoutes: [staticFixtureRoute, fakeKitRoute],
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
      name: 'a host that is not isolated and Document-Isolation-Policy',
      isolated: false,
      dip: true,
    },
  ]
) {
  test(`renders a card with ${mode.name}`, async ({ page }) => {
    const demo = await openDemo(page, servers, mode);
    expect(demo.hello).toEqual({
      version: 1,
      supported: true,
      builtinPackages: { '@lynx-js/react': 'fixture' },
    });
    expect(
      await page.evaluate(async () => {
        const preview = await window.demo.ready;
        return preview.open(window.demo.sampleFiles, window.demo.sampleConfig, {
          data: { initData: { from: 'host' } },
        });
      }),
    ).toEqual({ revision: 1 });
    const [done] = await demo.waitForEvents('build.done', 1);
    expect(await demo.waitForEvent('preview.load')).toEqual({
      card: 'main',
      hash: done!.hash,
      reason: 'open',
    });
    await expect(demo.card.locator('#title')).toHaveText('Main card');
    await expect(demo.card.locator('#init-data')).toHaveText('{"from":"host"}');
  });
}

test('reports supported: false when the iframe is not isolated', async ({ page }) => {
  const demo = await openDemo(page, servers, { isolated: false, dip: false });
  expect(demo.hello.supported).toBe(false);
  expect(demo.hello.reason).toMatch(/not cross-origin isolated/);
  const error = await page.evaluate(async () => {
    const preview = await window.demo.ready;
    try {
      await preview.open(window.demo.sampleFiles, window.demo.sampleConfig);
      return undefined;
    } catch (error) {
      const { name, code, method, message } = error as {
        name: string;
        code: string;
        method: string;
        message: string;
      };
      return { name, code, method, message };
    }
  });
  expect(error).toEqual({
    name: 'PreviewRequestError',
    code: 'UNSUPPORTED',
    method: 'project.open',
    message: `project.open failed with UNSUPPORTED: ${demo.hello.reason}`,
  });
});

test('the client sends every request, delivers events and can be disposed', async ({ page }) => {
  const demo = await openDemo(page, servers, { isolated: false, dip: true });
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(message.text());
    }
  });
  const result = await page.evaluate(async () => {
    const preview = await window.demo.ready;
    const builds: number[] = [];
    const waitForBuild = (revision: number) =>
      new Promise<void>((resolve) => {
        const off = preview.on('build.done', (data) => {
          if (data.revision === revision) {
            off();
            resolve();
          }
        });
      });
    let opens = 0;
    /** The second `open` load: the one after `project.configure`. */
    const reopened = new Promise<void>((resolve) => {
      preview.on('preview.load', (data) => {
        if (data.reason === 'open' && ++opens === 2) {
          resolve();
        }
      });
    });
    const off = preview.on('build.done', data => builds.push(data.revision));
    preview.on('build.start', () => {
      throw new Error('a listener that throws');
    });
    const files = window.demo.sampleFiles;
    const opened = await preview.open(files, window.demo.sampleConfig);
    await waitForBuild(1);
    const written = await preview.writeFile('src/extra.ts', 'export {};');
    const applied = await preview.applyChanges([
      { type: 'delete', path: 'src/extra.ts' },
    ]);
    await waitForBuild(3);
    const text = await preview.readFile('src/main.css');
    const binary = await preview.readFile('src/main.css', 'binary');
    const listed = await preview.listFiles();
    const asset = await preview.getAsset('main.web.bundle');
    const selected = await preview.selectCard('detail');
    await preview.reload();
    await preview.setData({ globalProps: { theme: 'dark' } });
    const requested = await preview.request('fs.list');
    const unknownCard = await preview.selectCard('nope').then(
      () => undefined,
      (error: { name: string; code: string; method: string }) => ({
        name: error.name,
        code: error.code,
        method: error.method,
      }),
    );
    off();
    const configured = await preview.configure({
      entries: { main: 'src/main.tsx' },
    });
    // The previewed card is no longer an entry: the first one opens.
    await reopened;
    await preview.close();

    // Disposing rejects the pending request and every later one.
    const pending = preview.reload();
    preview.dispose();
    preview.dispose();
    const reasons = await Promise.all(
      [pending, preview.listFiles()].map(promise =>
        promise.then(
          () => 'resolved',
          (error: { name: string; reason: string }) =>
            `${error.name} ${error.reason}`,
        )
      ),
    );
    return {
      opened,
      written,
      applied,
      text: text === files['src/main.css'],
      binary: binary instanceof Uint8Array
        && new TextDecoder().decode(binary) === files['src/main.css'],
      listed,
      asset: asset.byteLength > 0,
      selected,
      requested,
      unknownCard,
      configured,
      builds,
      reasons,
    };
  });
  expect(result).toEqual({
    opened: { revision: 1 },
    written: { revision: 2 },
    applied: { revision: 3 },
    text: true,
    binary: true,
    listed: Object.keys(await page.evaluate(() => window.demo.sampleFiles))
      .sort(),
    asset: true,
    selected: { card: 'detail' },
    requested: { files: result.listed },
    unknownCard: {
      name: 'PreviewRequestError',
      code: 'UNKNOWN_CARD',
      method: 'preview.select',
    },
    configured: { revision: 4 },
    // The listener was removed before the build of revision 4.
    builds: [1, 2, 3],
    reasons: [
      'PreviewClientError disposed',
      'PreviewClientError disposed',
    ],
  });
  // An exception in a listener is logged; the others still run.
  expect(errors.some(text => text.includes('a listener that throws'))).toBe(
    true,
  );
  expect(
    (await demo.events('preview.load')).map(item => item.data.reason),
  ).toEqual(['open', 'select', 'reload', 'open']);
});

test('connectPreview times out, can be aborted, and checks the version', async ({ page }) => {
  await openDemo(page, servers, { isolated: false, dip: true });
  const outcomes = await page.evaluate(async (kitOrigin) => {
    const frame = (name: string) => {
      const iframe = document.createElement('iframe');
      iframe.src = `${kitOrigin}/__fake__/${name}.html`;
      document.body.append(iframe);
      return iframe;
    };
    const outcome = (promise: Promise<unknown>) =>
      promise.then(
        () => 'connected',
        (error: { name: string; reason?: string; message: string }) =>
          [error.name, error.reason ?? error.message].join(' '),
      );
    const aborted = new AbortController();
    aborted.abort(new Error('aborted before'));
    const later = new AbortController();
    setTimeout(() => later.abort('stop'), 100);
    return {
      timeout: await outcome(
        window.demo.connectPreview(frame('silent'), {
          origin: kitOrigin,
          timeoutMs: 500,
        }),
      ),
      abortedBefore: await outcome(
        window.demo.connectPreview(frame('silent'), {
          origin: kitOrigin,
          signal: aborted.signal,
        }),
      ),
      abortedDuring: await outcome(
        window.demo.connectPreview(frame('silent'), {
          origin: kitOrigin,
          signal: later.signal,
        }),
      ),
      version: await outcome(
        window.demo.connectPreview(frame('v2'), { origin: kitOrigin }),
      ),
      // The kit, but expected from another origin: its `ready` is ignored.
      wrongOrigin: await outcome(
        window.demo.connectPreview(
          document.getElementById('preview') as HTMLIFrameElement,
          { origin: location.origin, timeoutMs: 500 },
        ),
      ),
    };
  }, servers.kitOrigin);
  expect(outcomes).toEqual({
    timeout: 'PreviewClientError timeout',
    abortedBefore: 'Error aborted before',
    abortedDuring: 'PreviewClientError disposed',
    version: 'Error The kit speaks protocol versions [2], not 1.',
    wrongOrigin: 'PreviewClientError timeout',
  });
});
