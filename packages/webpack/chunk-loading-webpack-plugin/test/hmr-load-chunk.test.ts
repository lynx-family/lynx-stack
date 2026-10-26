// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { runInNewContext } from 'node:vm';

import { rspack } from '@rspack/core';
import { expect, it } from '@rstest/core';

import { generateFromTemplate } from '../src/runtime/helper.js';
import hmrLoadChunkRuntime from '../src/runtime/javascript/hmr-load-chunk.js';

type Factory = () => string;
interface Update {
  modules: Record<string, Factory>;
  lynxRefreshModules?: (string | number)[];
}
type Callback = (error: Error | null, update: Update) => void;
type LoadUpdateChunk = (id: string, updatedModules?: string[]) => Promise<void>;
const oldFactory = () => 'old';
const newFactory = () => 'new';

function createLoader(
  currentUpdate: Record<string, Factory | false>,
  ownerId = 'owner',
) {
  const callbacks = new Map<string, Callback>();
  const requireModuleAsync = (url: string, callback: Callback) => {
    callbacks.set(url, callback);
  };
  const load = runInNewContext(
    `${generateFromTemplate(rspack, hmrLoadChunkRuntime)}\nloadUpdateChunk;`,
    {
      currentUpdate,
      currentUpdateRuntime: [],
      __webpack_require__: {
        p: '/',
        hu: (id: string) => `${id}.hot-update.js`,
        o: (object: object, key: string) => Object.hasOwn(object, key),
        c: { [ownerId]: {} },
        m: { [ownerId]: oldFactory },
      },
      lynx: { requireModuleAsync },
    },
  ) as LoadUpdateChunk;
  return {
    load,
    complete: (id: string, update: Update) =>
      callbacks.get(`/${id}.hot-update.js`)!(null, update),
  };
}

it.each([
  ['owner', 'runtime'],
  ['runtime', 'owner'],
])(
  'keeps the new factory when chunks complete in order %s, %s',
  async (first, second) => {
    const currentUpdate: Record<string, Factory | false> = {};
    const loader = createLoader(currentUpdate);
    const updatedModules: string[] = [];
    const pending = Promise.all([
      loader.load('runtime', updatedModules),
      loader.load('owner', updatedModules),
    ]);
    const updates: Record<string, Update> = {
      runtime: { modules: {}, lynxRefreshModules: ['owner'] },
      owner: { modules: { owner: newFactory } },
    };
    loader.complete(first!, updates[first!]!);
    loader.complete(second!, updates[second!]!);
    await pending;

    expect(currentUpdate).toEqual({ owner: newFactory });
    expect(updatedModules).toEqual(['owner']);
  },
);

it('replays a loaded unchanged owner once and skips unloaded owners', async () => {
  const currentUpdate: Record<string, Factory | false> = {};
  const loader = createLoader(currentUpdate);
  const updatedModules: string[] = [];
  const pending = loader.load('runtime', updatedModules);
  loader.complete('runtime', {
    modules: {},
    lynxRefreshModules: ['owner', 'owner', 'unloaded'],
  });
  await pending;

  expect(currentUpdate).toEqual({ owner: oldFactory });
  expect(updatedModules).toEqual(['owner']);
});

it('does not replay an owner removed by the update manifest', async () => {
  const currentUpdate: Record<string, Factory | false> = { owner: false };
  const loader = createLoader(currentUpdate);
  const updatedModules: string[] = [];
  const pending = loader.load('runtime', updatedModules);
  loader.complete('runtime', { modules: {}, lynxRefreshModules: ['owner'] });
  await pending;

  expect(currentUpdate).toEqual({ owner: false });
  expect(updatedModules).toEqual([]);
});

it.each(
  [
    { cached: false, update: { modules: { owner: newFactory } } },
    {
      cached: false,
      update: { modules: {}, lynxRefreshModules: ['owner', 'owner'] },
    },
    {
      cached: true,
      update: { modules: {}, lynxRefreshModules: ['owner', 'owner'] },
    },
  ] satisfies { cached: boolean; update: Update }[],
)(
  'reports listed owners after an overlapping chunk was loaded without a list: %j',
  async ({ cached, update }) => {
    const currentUpdate: Record<string, Factory | false> = {};
    const loader = createLoader(currentUpdate);
    const unlisted = loader.load('unlisted');
    loader.complete(
      'unlisted',
      cached
        ? { modules: {}, lynxRefreshModules: ['owner'] }
        : { modules: { owner: newFactory } },
    );
    await unlisted;

    const updatedModules: string[] = [];
    const listed = loader.load('listed', updatedModules);
    loader.complete('listed', update);
    await listed;

    expect(currentUpdate).toEqual({ owner: cached ? oldFactory : newFactory });
    expect(updatedModules).toEqual(['owner']);
  },
);

it('reports a module once for each supplied result list', async () => {
  const loader = createLoader({});
  const lists = [[], []] as string[][];
  const pending = Promise.all(
    lists.map((list, index) => loader.load(String(index), list)),
  );
  for (let index = 0; index < lists.length; index++) {
    loader.complete(String(index), { modules: { owner: newFactory } });
  }
  await pending;

  expect(lists).toEqual([['owner'], ['owner']]);
});

it.each([
  ['owner', 'runtime'],
  ['runtime', 'owner'],
])(
  'deduplicates numeric refresh IDs against factory keys in order %s, %s',
  async (first, second) => {
    const currentUpdate: Record<string, Factory | false> = {};
    const loader = createLoader(currentUpdate, '123');
    const updatedModules: string[] = [];
    const pending = Promise.all([
      loader.load('runtime', updatedModules),
      loader.load('owner', updatedModules),
    ]);
    const updates: Record<string, Update> = {
      runtime: { modules: {}, lynxRefreshModules: [123, '123'] },
      owner: { modules: { 123: newFactory } },
    };
    loader.complete(first!, updates[first!]!);
    loader.complete(second!, updates[second!]!);
    await pending;

    expect(currentUpdate).toEqual({ 123: newFactory });
    expect(updatedModules).toEqual(['123']);
  },
);
