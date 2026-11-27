// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// How the kit answers requests: messages it cannot answer, the order of
// responses, parameter and path checks, and every error code. The bundler
// worker is the static test double.

import path from 'node:path';

import { expect, test } from './coverage.js';
import {
  openKit,
  sampleProject,
  start,
  staticFixtureRoute,
} from './harness.js';
import type { Servers } from './harness.js';
import { workersDir } from './paths.js';

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

const config = { entries: { main: 'src/main.tsx', detail: 'src/detail.tsx' } };

test('drops what it cannot answer and answers the rest in arrival order', async ({ page }) => {
  const dropped: string[] = [];
  page.on('console', (message) => {
    if (message.text().includes('dropped a message without an id')) {
      dropped.push(message.text());
    }
  });
  await openKit(page, servers);
  const { files } = await sampleProject();
  const responses = await page.evaluate(async ({ files, config }) => {
    for (
      const message of [
        null,
        'text',
        1,
        { method: 'fs.list' },
        { id: '1', method: 'fs.list' },
      ]
    ) {
      window.kit.send(message);
    }
    window.kit.send({ id: 101 });
    window.kit.send({ id: 102, method: 7 });
    window.kit.send({ id: 103, method: 'fs.nope' });
    window.kit.send({ id: 104, method: 'toString' });
    // `project.open` waits for the bundler; the requests after it are
    // answered after it.
    window.kit.send({
      id: 105,
      method: 'project.open',
      params: { files, config },
    });
    window.kit.send({ id: 106, method: 'fs.list' });
    window.kit.send({ id: 107, method: 'preview.select', params: {} });
    while (window.kit.responses.length < 7) {
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    return window.kit.responses;
  }, { files, config });
  expect(responses).toEqual([
    {
      id: 101,
      error: {
        code: 'INVALID_REQUEST',
        message: 'A request needs a string method.',
      },
    },
    { id: 102, error: expect.objectContaining({ code: 'INVALID_REQUEST' }) },
    {
      id: 103,
      error: {
        code: 'UNKNOWN_METHOD',
        message: 'There is no method "fs.nope".',
      },
    },
    { id: 104, error: expect.objectContaining({ code: 'UNKNOWN_METHOD' }) },
    { id: 105, result: { revision: 1 } },
    { id: 106, result: { files: Object.keys(files).sort() } },
    {
      id: 107,
      error: {
        code: 'INVALID_PARAMS',
        message: 'card must be a non-empty string.',
      },
    },
  ]);
  expect(dropped).toHaveLength(5);
});

test('INVALID_PARAMS for parameters of the wrong shape', async ({ page }) => {
  const kit = await openKit(page, servers);
  const entries = { main: 'src/main.tsx' };
  const cases: [string, unknown][] = [
    ['project.open', undefined],
    ['project.open', []],
    ['project.open', { files: {}, config: { entries: {} } }],
    ['project.open', { files: {}, config: 'config' }],
    ['project.open', { files: {}, config: { entries: [] } }],
    ['project.open', { files: [], config: { entries } }],
    ['project.open', { files: 'files', config: { entries } }],
    ['project.open', { files: { 'a.ts': 1 }, config: { entries } }],
    ['project.open', { files: { 'a.ts': {} }, config: { entries } }],
    ['project.open', { files: {}, config: { entries: { '': 'a.ts' } } }],
    ['project.open', { files: {}, config: { entries: { a: 1 } } }],
    ['project.open', { files: {}, config: { entries, mode: 'test' } }],
    ['project.open', { files: {}, config: { entries, hmr: 1 } }],
    ['project.open', { files: {}, config: { entries }, card: 1 }],
    ['project.open', { files: {}, config: { entries }, card: '' }],
    ['project.open', { files: {}, config: { entries }, data: 1 }],
    ['project.open', { files: {}, config: { entries }, data: [] }],
    ['project.configure', undefined],
    ['project.configure', { config: { entries: { a: 1 } } }],
    ['project.close', 'now'],
    ['fs.apply', { changes: {} }],
    ['fs.apply', { changes: [1] }],
    ['fs.apply', { changes: [{ type: 'move', path: 'a' }] }],
    ['fs.apply', { changes: [{ type: 'write', path: 'a' }] }],
    ['fs.apply', { changes: [{ type: 'write', path: 1, content: '' }] }],
    ['fs.apply', { changes: [{ type: 'delete' }] }],
    ['fs.apply', { changes: [{ type: 'rename', from: 'a' }] }],
    ['fs.read', undefined],
    ['fs.read', { path: 1 }],
    ['fs.read', { path: 'a', encoding: 'latin1' }],
    ['fs.list', 'yes'],
    ['fs.list', []],
    ['build.getAsset', {}],
    ['preview.select', { card: '' }],
    ['preview.select', { card: 1 }],
    ['preview.reload', 1],
    ['preview.setData', 'data'],
    ['preview.setData', undefined],
  ];
  const codes = [];
  for (const [method, params] of cases) {
    codes.push([method, params, await kit.requestError(method, params)]);
  }
  expect(codes).toEqual(
    cases.map(([method, params]) => [method, params, 'INVALID_PARAMS']),
  );
});

test('the path rules: INVALID_PATH, and nothing of a rejected batch is applied', async ({ page }) => {
  const kit = await openKit(page, servers);
  const { files } = await sampleProject();
  await kit.request('project.open', { files, config });
  await kit.waitForEvents('build.done', 1);

  const batches = [
    [
      { type: 'write', path: 'ok.ts', content: '' },
      { type: 'write', path: '../escape.ts', content: '' },
    ],
    [{ type: 'delete', path: '/abs' }],
    [{ type: 'rename', from: 'a.ts', to: 'b//c.ts' }],
    [{ type: 'rename', from: 'a\\b', to: 'c' }],
    [{ type: 'write', path: 'src/', content: '' }],
    [{ type: 'write', path: './a.ts', content: '' }],
    [{ type: 'write', path: 'src/./a.ts', content: '' }],
    [{ type: 'write', path: 'src/../a.ts', content: '' }],
    [{ type: 'write', path: '..', content: '' }],
    [{ type: 'write', path: 'src/\0', content: '' }],
    [{ type: 'write', path: '', content: '' }],
  ];
  for (const changes of batches) {
    expect([changes, await kit.requestError('fs.apply', { changes })])
      .toEqual([changes, 'INVALID_PATH']);
  }
  const response = await kit.respond('fs.read', { path: '/src/main.tsx' });
  expect(response).toMatchObject({
    error: {
      code: 'INVALID_PATH',
      message:
        '"/src/main.tsx" is not a valid project path: it must be relative, use "/", and have no empty, "." or ".." segment.',
    },
  });
  expect(await kit.requestError('build.getAsset', { name: '..' })).toBe(
    'INVALID_PATH',
  );
  expect(
    await kit.requestError('project.open', {
      files: { 'src/./a.ts': '' },
      config,
    }),
  ).toBe('INVALID_PATH');
  expect(
    await kit.requestError('project.open', {
      files: {},
      config: { entries: { main: '/src/main.tsx' } },
    }),
  ).toBe('INVALID_PATH');
  // Nothing was applied, and nothing was built.
  expect(await kit.request('fs.list')).toEqual({
    files: Object.keys(files).sort(),
  });
  expect(await kit.events('build.start')).toHaveLength(1);

  // Paths that look odd but follow the rules.
  const accepted = [
    'node_modules/pkg/index.js',
    '.lynx/main/tasm.json',
    'src/.hidden',
    'a..b/c',
  ];
  expect(
    await kit.request('fs.apply', {
      changes: accepted.map(name => ({
        type: 'write',
        path: name,
        content: name,
      })),
    }),
  ).toEqual({ revision: 2 });
  expect((await kit.request('fs.list')).files).toEqual(
    [...Object.keys(files), ...accepted].sort(),
  );
});

test('NOT_OPEN, UNKNOWN_CARD, NOT_FOUND and INTERNAL', async ({ page }) => {
  const kit = await openKit(page, servers);
  const { files } = await sampleProject();
  const needOpen: [string, unknown][] = [
    ['project.configure', { config }],
    ['fs.apply', { changes: [] }],
    ['fs.read', { path: 'src/main.tsx' }],
    ['fs.list', undefined],
    ['build.getAsset', { name: 'main.web.bundle' }],
    ['preview.select', { card: 'main' }],
    ['preview.reload', undefined],
    ['preview.setData', {}],
  ];
  const before = [];
  for (const [method, params] of needOpen) {
    before.push([method, await kit.requestError(method, params)]);
  }
  expect(before).toEqual(needOpen.map(([method]) => [method, 'NOT_OPEN']));
  expect(await kit.requestError('project.close')).toBe('resolved');

  // A card that is not an entry; the project stays closed.
  expect(
    await kit.respond('project.open', { files, config, card: 'nope' }),
  ).toMatchObject({
    error: {
      code: 'UNKNOWN_CARD',
      message: '"nope" is not an entry of the project.',
    },
  });
  expect(await kit.requestError('fs.list')).toBe('NOT_OPEN');

  await kit.request('project.open', { files, config });
  await kit.waitForEvents('build.done', 1);
  expect(await kit.requestError('preview.select', { card: 'other' })).toBe(
    'UNKNOWN_CARD',
  );
  expect(await kit.respond('fs.read', { path: 'src/none.ts' })).toMatchObject(
    {
      error: { code: 'NOT_FOUND', message: 'There is no file src/none.ts.' },
    },
  );
  expect(await kit.requestError('build.getAsset', { name: 'none.js' })).toBe(
    'NOT_FOUND',
  );

  // Stored, but not an asset of the latest build.
  await kit.request('fs.apply', { changes: [] });
  const [first, second] = await kit.waitForEvents('build.done', 2);
  const old = `main.${first!.hash}.hot-update.json`;
  expect(first!.assets.map(asset => asset.name)).toContain(old);
  expect(second!.assets.map(asset => asset.name)).not.toContain(old);
  expect(await kit.respond('build.getAsset', { name: old })).toMatchObject({
    error: {
      code: 'NOT_FOUND',
      message: `The latest build has no asset ${old}.`,
    },
  });

  // The bundler fails: INTERNAL, and the revision does not advance.
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
  expect(await kit.request('fs.apply', { changes: [] })).toEqual({
    revision: 3,
  });

  await kit.request('project.close');
  expect(await kit.requestError('preview.reload')).toBe('NOT_OPEN');
});

test('passes the checked parameters on: bytes, and no unknown fields', async ({ page }) => {
  const kit = await openKit(page, servers);
  const result = await page.evaluate(async (config) => {
    const bytes = new Uint8Array([1, 2, 3]);
    const open = await window.kit.request('project.open', {
      files: {
        'src/main.tsx': 'main',
        'src/detail.tsx': 'detail',
        'node_modules/pkg/index.bin': bytes,
      },
      config: { ...config, extra: true },
      unknown: 1,
    });
    const binary = await window.kit.request('fs.read', {
      path: 'node_modules/pkg/index.bin',
      encoding: 'binary',
    });
    const text = await window.kit.request('fs.read', {
      path: 'src/main.tsx',
      encoding: 'utf8',
    });
    const asBinary = await window.kit.request('fs.read', {
      path: 'src/main.tsx',
      encoding: 'binary',
    });
    const content = (binary as { result: { content: Uint8Array } }).result
      .content;
    return {
      open,
      binary: content instanceof Uint8Array ? [...content] : content,
      text,
      asBinary: [
        ...(asBinary as { result: { content: Uint8Array } }).result.content,
      ],
    };
  }, config);
  expect(result).toEqual({
    open: { id: expect.any(Number), result: { revision: 1 } },
    binary: [1, 2, 3],
    text: { id: expect.any(Number), result: { content: 'main' } },
    asBinary: [...new TextEncoder().encode('main')],
  });
  expect((await kit.request('fs.list')).files).toEqual([
    'node_modules/pkg/index.bin',
    'src/detail.tsx',
    'src/main.tsx',
  ]);
});

test('a bundler worker that crashes fails the pending request', async ({ page }) => {
  const kit = await openKit(page, servers);
  const { files } = await sampleProject();
  await kit.request('project.open', {
    files: { ...files, 'static-worker.json': JSON.stringify({ crash: true }) },
    config,
  });
  const response = await kit.respond('fs.list');
  expect(response).toMatchObject({ error: { code: 'INTERNAL' } });
  expect('error' in response && response.error.message).toMatch(
    /^The bundler worker failed: .*the bundler crashed/,
  );
});
