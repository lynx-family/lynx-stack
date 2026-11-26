// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core';

import type {
  BuildEvent,
  BuildResult,
  FileChange,
  FileMap,
  WebBundler,
  WebBundlerOptions,
} from '@lynx-js/web-bundle-kit';

import { BundlerHost } from '../../src/worker/host.js';
import type { BundlerConfig, WorkerEvent } from '../../src/worker/messages.js';

const tick = () => new Promise(resolve => setTimeout(resolve, 0));

/**
 * Behaves like the bundle kit's watch mode: `applyChanges` writes at once;
 * an idle watcher starts a compilation right away, and changes that arrive
 * while one runs are merged into the next. A compilation ends when the test
 * calls `finish`.
 */
class FakeBundler implements WebBundler {
  files: FileMap;
  listener: ((event: BuildEvent) => void) | undefined;
  running: FileMap | undefined;
  pending = false;
  builds: FileMap[] = [];
  closed = false;

  constructor(options: WebBundlerOptions) {
    this.files = { ...options.files };
  }

  applyChanges(changes: FileChange[]): Promise<void> {
    for (const change of changes) {
      if (change.type === 'write') {
        this.files[change.path] = change.content;
      }
    }
    if (this.running) {
      this.pending = true;
    } else {
      this.#start();
    }
    return Promise.resolve();
  }

  #start() {
    this.running = { ...this.files };
    this.listener?.({ type: 'start' });
  }

  /** Ends the running compilation; starts the merged one, if any. */
  finish(errors: string[] = []) {
    const files = this.running!;
    this.running = undefined;
    this.builds.push(files);
    const result: BuildResult = {
      hash: `h${this.builds.length}`,
      durationMs: 1,
      errors: errors.map(message => ({ message })),
      warnings: [],
      cards: [],
      assets: [{ name: 'main.web.bundle', size: 1 }],
      emitted: [{ name: 'main.web.bundle', content: new Uint8Array([1]) }],
    };
    this.listener?.({ type: 'done', result });
    if (this.pending) {
      this.pending = false;
      this.#start();
    }
  }

  readFile(path: string) {
    const content = this.files[path];
    return Promise.resolve(
      typeof content === 'string' ? new TextEncoder().encode(content) : content,
    );
  }
  listFiles() {
    return Promise.resolve(Object.keys(this.files).sort());
  }
  build(): Promise<BuildResult> {
    return Promise.reject(new Error('not used'));
  }
  watch(listener: (event: BuildEvent) => void) {
    this.listener = listener;
    this.#start();
    return new Promise<void>(() => {});
  }
  close() {
    this.closed = true;
    return Promise.resolve();
  }
}

const config: BundlerConfig = {
  entries: { main: 'src/main.tsx' },
  mode: 'development',
  hmr: true,
  publicPath: 'https://kit.test/p/',
  cacheName: 'c',
};

function setup() {
  const bundlers: FakeBundler[] = [];
  const messages: WorkerEvent[] = [];
  const stored: string[] = [];
  const host = new BundlerHost({
    createWebBundler(options) {
      const bundler = new FakeBundler(options);
      bundlers.push(bundler);
      return Promise.resolve(bundler);
    },
    async writeAssets(_cache, _publicPath, assets) {
      await tick();
      stored.push(...assets.map(asset => asset.name));
      messages.push({ type: 'stored' } as unknown as WorkerEvent);
    },
    post: message => messages.push(message),
  });
  const builds = () =>
    messages.filter(message =>
      message.type === 'build-start' || message.type === 'build-done'
    ).map(message =>
      message.type === 'build-done'
        ? `done ${message.revision} ${message.report.hash}`
        : `start ${(message as { revision: number }).revision}`
    );
  return { host, bundlers, messages, stored, builds };
}

const write = (path: string, content: string): FileChange => ({
  type: 'write',
  path,
  content,
});

describe('BundlerHost', () => {
  test('a build is reported after its assets are stored', async () => {
    const t = setup();
    await t.host.receive({
      type: 'start',
      id: 1,
      generation: 1,
      revision: 1,
      config,
      files: { 'src/main.tsx': 'v1' },
    });
    t.bundlers[0]!.finish();
    await tick();
    await tick();
    expect(t.messages.map(message => message.type)).toEqual([
      'build-start',
      'reply',
      'stored',
      'build-done',
    ]);
  });

  test('the revision of a build covers every change it includes, merged ones too', async () => {
    const t = setup();
    await t.host.receive({
      type: 'start',
      id: 1,
      generation: 1,
      revision: 1,
      config,
      files: {},
    });
    const bundler = t.bundlers[0]!;
    bundler.finish();
    // Revision 2 starts a compilation; 3 and 4 arrive while it runs.
    await t.host.receive({
      type: 'apply',
      id: 2,
      revision: 2,
      changes: [write('a', '2')],
    });
    await t.host.receive({
      type: 'apply',
      id: 3,
      revision: 3,
      changes: [write('b', '3')],
    });
    await t.host.receive({
      type: 'apply',
      id: 4,
      revision: 4,
      changes: [write('a', '4')],
    });
    bundler.finish();
    bundler.finish();
    for (let i = 0; i < 6; i++) await tick();
    expect(t.builds()).toEqual([
      'start 1',
      'done 1 h1',
      'start 2',
      'done 2 h2',
      'start 4',
      'done 4 h3',
    ]);
    expect(bundler.builds[1]).toEqual({ a: '2' });
    expect(bundler.builds[2]).toEqual({ a: '4', b: '3' });
  });

  test('start with files: null keeps the files; events of a closed bundler are dropped', async () => {
    const t = setup();
    await t.host.receive({
      type: 'start',
      id: 1,
      generation: 1,
      revision: 1,
      config,
      files: { 'src/main.tsx': 'v1' },
    });
    await t.host.receive({
      type: 'start',
      id: 2,
      generation: 2,
      revision: 2,
      config,
      files: null,
    });
    expect(t.bundlers[0]!.closed).toBe(true);
    expect(t.bundlers[1]!.files).toEqual({
      'src/main.tsx': new TextEncoder().encode('v1'),
    });
    t.bundlers[0]!.finish();
    t.bundlers[1]!.finish();
    for (let i = 0; i < 4; i++) await tick();
    // The first bundler's build started before it was replaced and never ends.
    expect(t.builds()).toEqual(['start 1', 'start 2', 'done 2 h1']);
    expect(
      t.messages.filter(message => message.type === 'build-done').map(
        message => (message as { generation: number }).generation,
      ),
    ).toEqual([2]);
  });

  test('read, list, close and errors', async () => {
    const t = setup();
    await t.host.receive({ type: 'list', id: 1 });
    expect(t.messages.at(-1)).toEqual({
      type: 'reply',
      id: 1,
      error: 'No project is open.',
    });
    await t.host.receive({
      type: 'start',
      id: 2,
      generation: 1,
      revision: 1,
      config,
      files: { 'b.ts': 'b', 'a.ts': 'a' },
    });
    await t.host.receive({ type: 'list', id: 3 });
    expect(t.messages.at(-1)).toEqual({
      type: 'reply',
      id: 3,
      result: ['a.ts', 'b.ts'],
    });
    await t.host.receive({ type: 'read', id: 4, path: 'none' });
    expect(t.messages.at(-1)).toEqual({ type: 'reply', id: 4, result: null });
    await t.host.receive({ type: 'close', id: 5 });
    expect(t.bundlers[0]!.closed).toBe(true);
    await t.host.receive({ type: 'apply', id: 6, revision: 2, changes: [] });
    expect(t.messages.at(-1)).toMatchObject({
      id: 6,
      error: 'No project is open.',
    });
  });
});
