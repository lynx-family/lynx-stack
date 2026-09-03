// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { rspack } from '@rspack/core';
import { describe, expect, test } from '@rstest/core';

import { RuntimeWrapperWebpackPlugin } from '../src/index.js';

function wrap(assets) {
  const updated = new Map();
  let processAssets;
  const compilation = {
    chunks: Object.entries(assets).map(([name, info], id) => ({
      id,
      files: new Set([name]),
      info,
    })),
    getAsset: (name) => ({ name, info: assets[name] }),
    getPath: (str) => str,
    updateAsset: (name, update) => {
      updated.set(name, update(new rspack.sources.RawSource('body')).source());
    },
    hooks: {
      processAssets: {
        tap: (_options, callback) => {
          processAssets = callback;
        },
      },
    },
  };
  const compiler = {
    webpack: rspack,
    options: { mode: 'production', output: {} },
    hooks: {
      thisCompilation: {
        tap: (_name, callback) => callback(compilation),
      },
    },
  };

  new RuntimeWrapperWebpackPlugin({ targetSdkVersion: '3.2' }).apply(compiler);
  processAssets();
  return updated;
}

describe('RuntimeWrapperWebpackPlugin', () => {
  test('wraps a background asset and leaves a main-thread one alone', () => {
    const updated = wrap({
      'background.js': {},
      'main-thread.js': { 'lynx:main-thread': true },
      'style.css': {},
    });

    expect([...updated.keys()]).toStrictEqual(['background.js']);
    expect(updated.get('background.js')).toMatch(/^\(function\(\)\{/);
    expect(updated.get('background.js')).toContain('\nbody\n');
    expect(updated.get('background.js')).toMatch(/\}\)\(\);\s*$/);
  });
});
