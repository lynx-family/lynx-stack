// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core';

import type { AssetStore } from '../../src/page/assetStore.js';
import { RequestRouter } from '../../src/page/router.js';
import { Session } from '../../src/page/session.js';
import type {
  BundlerClient,
  CardHost,
  DevServerMessage,
  Support,
} from '../../src/page/session.js';
import type {
  EventName,
  Events,
  FileChange,
  FileMap,
  MethodName,
  Methods,
  PreviewData,
  ProjectConfig,
} from '../../src/protocol.js';
import type { BuildReport, BundlerConfig } from '../../src/worker/messages.js';

const PUBLIC_PATH = 'https://kit.test/__lynx_preview__/abc/';

class FakeBundler implements BundlerClient {
  calls: unknown[][] = [];
  files: FileMap = {};

  start(
    generation: number,
    revision: number,
    config: BundlerConfig,
    files: FileMap | null,
  ) {
    this.calls.push(['start', generation, revision, config, files]);
    if (files) {
      this.files = { ...files };
    }
    return Promise.resolve();
  }
  apply(revision: number, changes: FileChange[]) {
    this.calls.push(['apply', revision, changes]);
    for (const change of changes) {
      if (change.type === 'write') {
        this.files[change.path] = change.content;
      }
    }
    return Promise.resolve();
  }
  read(path: string) {
    const content = this.files[path];
    return Promise.resolve(
      content === undefined
        ? null
        : typeof content === 'string'
        ? new TextEncoder().encode(content)
        : content,
    );
  }
  list() {
    return Promise.resolve(Object.keys(this.files).sort());
  }
  close() {
    this.calls.push(['close']);
    return Promise.resolve();
  }
}

class FakeHost implements CardHost {
  log: unknown[][] = [];
  load(url: string, data: PreviewData) {
    this.log.push(['load', url, data]);
  }
  clear() {
    this.log.push(['clear']);
  }
  setData(data: PreviewData) {
    this.log.push(['setData', data]);
  }
  sendDevServerMessage(message: DevServerMessage) {
    this.log.push(['devServer', message]);
  }
}

class FakeAssets implements AssetStore {
  stored = new Map<string, Uint8Array>();
  log: unknown[][] = [];
  clear() {
    this.log.push(['clear']);
    return Promise.resolve();
  }
  read(name: string) {
    return Promise.resolve(this.stored.get(name));
  }
  prune(names: string[]) {
    this.log.push(['prune', names]);
    return Promise.resolve();
  }
  snapshot(key: string) {
    return Promise.resolve(`${PUBLIC_PATH}.cards/${key}/`);
  }
}

function setup(support: Support = { supported: true }) {
  const bundler = new FakeBundler();
  const host = new FakeHost();
  const assets = new FakeAssets();
  const events: { event: EventName; data: unknown }[] = [];
  const session = new Session({
    support,
    builtinPackages: { '@lynx-js/react': '1.0.0' },
    publicPath: PUBLIC_PATH,
    cacheName: 'lynx-preview:abc',
    bundler,
    assets,
    host,
    emit(event, data) {
      events.push({ event, data });
    },
  });
  const router = new RequestRouter(session.handlers);
  async function request<M extends MethodName>(
    method: M,
    params?: Methods[M]['params'],
  ): Promise<Methods[M]['result']> {
    let answer: unknown;
    router.receive({ id: 1, method, params }, (response) => {
      answer = response;
    });
    await router.idle();
    if ('error' in (answer as object)) {
      throw (answer as { error: unknown }).error;
    }
    return (answer as { result: Methods[M]['result'] }).result;
  }
  async function code(method: MethodName, params?: unknown) {
    try {
      await request(method, params as never);
      return 'resolved';
    } catch (error) {
      return (error as { code: string }).code;
    }
  }
  /** The generation of the bundler started last. */
  const generation = () =>
    (bundler.calls.filter(call => call[0] === 'start').at(-1)![1]) as number;
  const eventsOf = <E extends EventName>(name: E) =>
    events.filter(item => item.event === name).map(item =>
      item.data as Events[E]
    );
  return {
    session,
    bundler,
    host,
    assets,
    events,
    eventsOf,
    request,
    code,
    generation,
  };
}

const config: ProjectConfig = {
  entries: { main: 'src/main.tsx', detail: 'src/detail.tsx' },
};
const files: FileMap = { 'src/main.tsx': 'main', 'src/detail.tsx': 'detail' };

function report(hash: string, errors: string[] = []): BuildReport {
  return {
    hash,
    durationMs: 10,
    errors: errors.map(message => ({ message })),
    warnings: [],
    cards: [
      { name: 'main', entry: 'src/main.tsx', bundle: 'main.web.bundle' },
      { name: 'detail', entry: 'src/detail.tsx', bundle: 'detail.web.bundle' },
    ],
    assets: [
      { name: 'main.web.bundle', size: 1 },
      { name: 'detail.web.bundle', size: 1 },
      { name: `main.${hash}.hot-update.json`, size: 1 },
    ],
  };
}

async function openAndBuild(t: ReturnType<typeof setup>) {
  await t.request('project.open', { files, config });
  const generation = t.generation();
  t.session.buildStarted(generation, 1);
  await t.session.buildDone(generation, 1, report('h1'));
  return generation;
}

describe('Session', () => {
  test('hello', () => {
    expect(setup().session.hello).toEqual({
      version: 1,
      supported: true,
      builtinPackages: { '@lynx-js/react': '1.0.0' },
    });
    expect(
      setup({ supported: false, reason: 'not isolated' }).session.hello,
    ).toEqual({
      version: 1,
      supported: false,
      reason: 'not isolated',
      builtinPackages: { '@lynx-js/react': '1.0.0' },
    });
  });

  test('project.open starts a bundler and loads the first card after the first successful build', async () => {
    const t = setup();
    expect(
      await t.request('project.open', {
        files,
        config,
        data: { initData: { a: 1 } },
      }),
    ).toEqual({ revision: 1 });
    expect(t.bundler.calls).toEqual([[
      'start',
      1,
      1,
      {
        entries: config.entries,
        mode: 'development',
        hmr: true,
        publicPath: PUBLIC_PATH,
        cacheName: 'lynx-preview:abc',
      },
      files,
    ]]);
    expect(t.assets.log).toEqual([['clear']]);
    expect(t.host.log).toEqual([['clear']]);

    t.session.buildStarted(1, 1);
    await t.session.buildDone(1, 1, report('h1'));
    expect(t.events).toEqual([
      { event: 'build.start', data: { buildId: 1, revision: 1 } },
      {
        event: 'build.done',
        data: {
          buildId: 1,
          revision: 1,
          success: true,
          hash: 'h1',
          durationMs: 10,
          errors: [],
          warnings: [],
          cards: report('h1').cards,
          assets: report('h1').assets,
        },
      },
      {
        event: 'preview.load',
        data: { card: 'main', hash: 'h1', reason: 'open' },
      },
    ]);
    expect(t.host.log.at(-1)).toEqual([
      'load',
      `${PUBLIC_PATH}.cards/1/main.web.bundle?load=1`,
      { initData: { a: 1 } },
    ]);
    expect(t.assets.log.at(-1)).toEqual([
      'prune',
      report('h1').assets.map(asset => asset.name),
    ]);
  });

  test('project.open previews the requested card', async () => {
    const t = setup();
    await t.request('project.open', { files, config, card: 'detail' });
    await t.session.buildDone(t.generation(), 1, report('h1'));
    expect(t.eventsOf('preview.load')).toEqual([
      { card: 'detail', hash: 'h1', reason: 'open' },
    ]);
    expect(await t.code('project.open', { files, config, card: 'nope' })).toBe(
      'UNKNOWN_CARD',
    );
  });

  test('a successful rebuild is a hot update', async () => {
    const t = setup();
    const generation = await openAndBuild(t);
    expect(
      await t.request('fs.apply', {
        changes: [{ type: 'write', path: 'src/main.tsx', content: 'v2' }],
      }),
    ).toEqual({ revision: 2 });
    expect(t.bundler.calls.at(-1)).toEqual([
      'apply',
      2,
      [{ type: 'write', path: 'src/main.tsx', content: 'v2' }],
    ]);
    t.session.buildStarted(generation, 2);
    await t.session.buildDone(generation, 2, report('h2'));
    expect(t.host.log.slice(-2)).toEqual([
      ['devServer', { type: 'hash', data: 'h2' }],
      ['devServer', { type: 'ok' }],
    ]);
    expect(t.events.slice(-3).map(item => item.event)).toEqual([
      'build.start',
      'build.done',
      'preview.hmr',
    ]);
    expect(t.eventsOf('preview.hmr')).toEqual([{ card: 'main', hash: 'h2' }]);
    expect(t.eventsOf('build.start').at(-1)).toEqual({
      buildId: 2,
      revision: 2,
    });
  });

  test('a failed build is reported and nothing follows', async () => {
    const t = setup();
    const generation = await openAndBuild(t);
    const before = t.events.length;
    t.session.buildStarted(generation, 2);
    await t.session.buildDone(generation, 2, report('h2', ['broken']));
    expect(t.events.slice(before)).toEqual([
      { event: 'build.start', data: { buildId: 2, revision: 2 } },
      {
        event: 'build.done',
        data: expect.objectContaining({
          buildId: 2,
          success: false,
          cards: [],
          errors: [{ message: 'broken' }],
        }),
      },
    ]);
    expect(t.host.log.slice(-2)).toEqual([
      ['devServer', { type: 'hash', data: 'h2' }],
      ['devServer', { type: 'errors', data: { text: ['broken'] } }],
    ]);
    // A reload loads the latest successful build.
    await t.request('preview.reload');
    expect(t.eventsOf('preview.load').at(-1)).toEqual({
      card: 'main',
      hash: 'h1',
      reason: 'reload',
    });
    expect(t.host.log.at(-1)?.[1]).toBe(
      `${PUBLIC_PATH}.cards/1/main.web.bundle?load=2`,
    );
  });

  test('the first success after a failed build reloads the card instead of hot-updating it', async () => {
    const t = setup();
    const generation = await openAndBuild(t);
    await t.session.buildDone(generation, 2, report('h2', ['broken']));
    const messages = t.host.log.length;
    await t.session.buildDone(generation, 3, report('h3'));
    expect(t.host.log.slice(messages).map(entry => entry[0])).toEqual(['load']);
    expect(t.eventsOf('preview.load').at(-1)).toEqual({
      card: 'main',
      hash: 'h3',
      reason: 'hmr-fallback',
    });
    expect(t.eventsOf('preview.hmr')).toEqual([]);
    // Then hot updates again.
    await t.session.buildDone(generation, 4, report('h4'));
    expect(t.eventsOf('preview.hmr')).toEqual([{ card: 'main', hash: 'h4' }]);
    expect(t.host.log.slice(-2)).toEqual([
      ['devServer', { type: 'hash', data: 'h4' }],
      ['devServer', { type: 'ok' }],
    ]);
  });

  test('a card loaded from the last good build after a failed one also reloads on the next success', async () => {
    const t = setup();
    const generation = await openAndBuild(t);
    await t.session.buildDone(generation, 2, report('h2', ['broken']));
    await t.request('preview.select', { card: 'detail' });
    expect(t.eventsOf('preview.load').at(-1)).toMatchObject({ hash: 'h1' });
    await t.session.buildDone(generation, 3, report('h3'));
    expect(t.eventsOf('preview.load').at(-1)).toEqual({
      card: 'detail',
      hash: 'h3',
      reason: 'hmr-fallback',
    });
    expect(t.eventsOf('preview.hmr')).toEqual([]);
  });

  test('a failure before the card was first loaded does not cause a fallback', async () => {
    const t = setup();
    const generation = await openAndBuild(t);
    await t.session.buildDone(generation, 2, report('h2'));
    expect(t.eventsOf('preview.hmr')).toEqual([{ card: 'main', hash: 'h2' }]);
    await t.request('project.open', { files, config });
    await t.session.buildDone(t.generation(), 1, report('h3', ['broken']));
    await t.session.buildDone(t.generation(), 2, report('h4'));
    await t.session.buildDone(t.generation(), 3, report('h5'));
    expect(t.eventsOf('preview.load').slice(-1)).toEqual([
      { card: 'main', hash: 'h4', reason: 'open' },
    ]);
    expect(t.eventsOf('preview.hmr').at(-1)).toEqual({
      card: 'main',
      hash: 'h5',
    });
  });

  test('a failed first build loads nothing; the next success opens the card', async () => {
    const t = setup();
    await t.request('project.open', { files, config });
    await t.session.buildDone(t.generation(), 1, report('h1', ['broken']));
    expect(t.eventsOf('preview.load')).toEqual([]);
    expect(t.host.log.filter(entry => entry[0] === 'devServer')).toEqual([]);
    await t.request('preview.reload');
    expect(t.eventsOf('preview.load')).toEqual([]);
    await t.session.buildDone(t.generation(), 2, report('h2'));
    expect(t.eventsOf('preview.load')).toEqual([
      { card: 'main', hash: 'h2', reason: 'open' },
    ]);
  });

  test.each([
    { hmr: false, mode: 'development' as const },
    { hmr: true, mode: 'production' as const },
  ])('a rebuild reloads the card with %o', async ({ hmr, mode }) => {
    const t = setup();
    await t.request('project.open', {
      files,
      config: { ...config, hmr, mode },
    });
    expect((t.bundler.calls[0]![3] as BundlerConfig).hmr).toBe(false);
    await t.session.buildDone(t.generation(), 1, report('h1'));
    await t.session.buildDone(t.generation(), 2, report('h2'));
    expect(t.eventsOf('preview.load')).toEqual([
      { card: 'main', hash: 'h1', reason: 'open' },
      { card: 'main', hash: 'h2', reason: 'rebuild' },
    ]);
    expect(t.eventsOf('preview.hmr')).toEqual([]);
    expect(t.host.log.filter(entry => entry[0] === 'devServer')).toEqual([]);
  });

  test('preview.select, preview.reload and the HMR fallback load the card', async () => {
    const t = setup();
    await openAndBuild(t);
    expect(await t.request('preview.select', { card: 'detail' })).toEqual({
      card: 'detail',
    });
    await t.request('preview.reload');
    t.session.reloadRequested();
    expect(t.eventsOf('preview.load')).toEqual([
      { card: 'main', hash: 'h1', reason: 'open' },
      { card: 'detail', hash: 'h1', reason: 'select' },
      { card: 'detail', hash: 'h1', reason: 'reload' },
      { card: 'detail', hash: 'h1', reason: 'hmr-fallback' },
    ]);
    const urls = t.host.log.filter(entry => entry[0] === 'load').map(entry =>
      entry[1]
    );
    expect(new Set(urls).size).toBe(4);
    expect(await t.code('preview.select', { card: 'other' })).toBe(
      'UNKNOWN_CARD',
    );
  });

  test('preview.select before a build loads with the first build', async () => {
    const t = setup();
    await t.request('project.open', { files, config });
    await t.request('preview.select', { card: 'detail' });
    expect(t.eventsOf('preview.load')).toEqual([]);
    await t.session.buildDone(t.generation(), 1, report('h1'));
    expect(t.eventsOf('preview.load')).toEqual([
      { card: 'detail', hash: 'h1', reason: 'open' },
    ]);
  });

  test('preview.setData merges and applies to later loads', async () => {
    const t = setup();
    await t.request('project.open', {
      files,
      config,
      data: { initData: { a: 1 }, globalProps: { theme: 'light' } },
    });
    await t.request('preview.setData', { globalProps: { theme: 'dark' } });
    expect(t.host.log.at(-1)).toEqual([
      'setData',
      { globalProps: { theme: 'dark' } },
    ]);
    await t.session.buildDone(t.generation(), 1, report('h1'));
    expect(t.host.log.at(-1)).toEqual([
      'load',
      expect.any(String),
      { initData: { a: 1 }, globalProps: { theme: 'dark' } },
    ]);
  });

  test('the running card reports errors', async () => {
    const t = setup();
    t.session.cardError({ message: 'ignored, nothing is loaded' });
    await openAndBuild(t);
    t.session.cardError({ message: 'boom', stack: 'at x', fileName: 'a.js' });
    expect(t.eventsOf('preview.error')).toEqual([
      { card: 'main', message: 'boom', stack: 'at x', fileName: 'a.js' },
    ]);
  });

  test('project.configure keeps the files and opens the card again', async () => {
    const t = setup();
    const first = await openAndBuild(t);
    await t.request('preview.select', { card: 'detail' });
    expect(
      await t.request('project.configure', {
        config: { entries: { main: 'src/main.tsx' } },
      }),
    ).toEqual({ revision: 2 });
    const second = t.generation();
    expect(second).toBeGreaterThan(first);
    expect(t.bundler.calls.at(-1)).toEqual([
      'start',
      second,
      2,
      expect.objectContaining({ entries: { main: 'src/main.tsx' } }),
      null,
    ]);
    // Events of the old bundler are ignored.
    t.session.buildStarted(first, 1);
    await t.session.buildDone(first, 1, report('old'));
    expect(t.eventsOf('build.done')).toHaveLength(1);
    await t.session.buildDone(second, 2, report('h2'));
    expect(t.eventsOf('preview.load').at(-1)).toEqual({
      card: 'main',
      hash: 'h2',
      reason: 'open',
    });
    expect(await t.request('fs.apply', { changes: [] })).toEqual({
      revision: 3,
    });
  });

  test('fs.read, fs.list and build.getAsset', async () => {
    const t = setup();
    await openAndBuild(t);
    expect(await t.request('fs.read', { path: 'src/main.tsx' })).toEqual({
      content: 'main',
    });
    expect(
      await t.request('fs.read', { path: 'src/main.tsx', encoding: 'binary' }),
    ).toEqual({ content: new TextEncoder().encode('main') });
    expect(await t.code('fs.read', { path: 'src/none.tsx' })).toBe('NOT_FOUND');
    expect(await t.request('fs.list')).toEqual({
      files: ['src/detail.tsx', 'src/main.tsx'],
    });
    t.assets.stored.set('main.web.bundle', new Uint8Array([1, 2, 3]));
    t.assets.stored.set('stale.js', new Uint8Array([1]));
    expect(await t.request('build.getAsset', { name: 'main.web.bundle' }))
      .toEqual({ content: new Uint8Array([1, 2, 3]) });
    // Stored but not an asset of the latest build.
    expect(await t.code('build.getAsset', { name: 'stale.js' })).toBe(
      'NOT_FOUND',
    );
  });

  test('NOT_OPEN before project.open and after project.close', async () => {
    const t = setup();
    const needOpen: [MethodName, unknown][] = [
      ['project.configure', { config }],
      ['fs.apply', { changes: [] }],
      ['fs.read', { path: 'a' }],
      ['fs.list', undefined],
      ['build.getAsset', { name: 'a' }],
      ['preview.select', { card: 'main' }],
      ['preview.reload', undefined],
      ['preview.setData', {}],
    ];
    for (const [method, params] of needOpen) {
      expect([method, await t.code(method, params)]).toEqual([
        method,
        'NOT_OPEN',
      ]);
    }
    expect(await t.request('project.close')).toBeUndefined();
    const generation = await openAndBuild(t);
    await t.request('project.close');
    expect(t.bundler.calls.at(-1)).toEqual(['close']);
    expect(t.host.log.at(-1)).toEqual(['clear']);
    expect(t.assets.log.at(-1)).toEqual(['clear']);
    expect(await t.code('preview.reload')).toBe('NOT_OPEN');
    // A build that finishes after the close is ignored.
    const count = t.events.length;
    await t.session.buildDone(generation, 2, report('late'));
    expect(t.events).toHaveLength(count);
  });

  test('UNSUPPORTED when the kit cannot build', async () => {
    const t = setup({ supported: false, reason: 'no isolation' });
    expect(await t.code('project.open', { files, config })).toBe(
      'UNSUPPORTED',
    );
    expect(await t.code('fs.list')).toBe('UNSUPPORTED');
    expect(await t.request('project.close')).toBeUndefined();
    expect(t.bundler.calls).toEqual([]);
  });

  test('a build done without a start gets its own build id', async () => {
    const t = setup();
    await t.request('project.open', { files, config });
    await t.session.buildDone(t.generation(), 1, report('h1'));
    t.session.buildStarted(t.generation(), 1);
    await t.session.buildDone(t.generation(), 1, report('h2'));
    expect(t.eventsOf('build.done').map(item => item.buildId)).toEqual([1, 2]);
    expect(t.eventsOf('build.start')).toEqual([{ buildId: 2, revision: 1 }]);
  });
});
