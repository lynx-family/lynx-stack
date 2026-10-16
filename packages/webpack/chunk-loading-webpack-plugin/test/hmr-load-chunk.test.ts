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
  lynxRefreshModules?: string[];
}
type Callback = (error: Error | null, update: Update) => void;
type LoadUpdateChunk = (id: string, updatedModules: string[]) => Promise<void>;
const oldFactory = () => 'old';
const newFactory = () => 'new';

function createLoader(currentUpdate: Record<string, Factory | false>) {
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
        c: { owner: {} },
        m: { owner: oldFactory },
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
