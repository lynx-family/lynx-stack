// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { dirname } from 'node:path';

import { describe, expect, test } from '@rstest/core';
import webpack from 'webpack';

import { LynxEncodePlugin, LynxTemplatePlugin } from '../src/index.js';

const context = dirname(new URL(import.meta.url).pathname);

function runWebpack(config: webpack.Configuration): Promise<webpack.Stats> {
  const compiler = webpack(config);
  return new Promise((resolve, reject) => {
    compiler.run((err, stats) => {
      if (err) return reject(err);
      if (!stats) return reject(new Error('webpack returned empty stats'));
      resolve(stats);
      compiler.close(() => void 0);
    });
  });
}

describe('LynxEncodePlugin shared worker pool', () => {
  // The static `LynxEncodePlugin.encodePool` is a process-wide singleton.
  // These tests rely on rstest running each file in its own worker process,
  // so the pool starts fresh for this file and the assertions below see
  // monotonic state.

  test('runs multi-entry encodes in parallel via the shared pool', async () => {
    const completedBefore = LynxEncodePlugin.encodePool.completed;

    const stats = await runWebpack({
      context,
      mode: 'development',
      devtool: false,
      output: { iife: false, filename: '[name].js' },
      entry: {
        a: './fixtures/basic.tsx',
        b: './fixtures/basic.tsx',
      },
      plugins: [
        new LynxTemplatePlugin(),
        new LynxEncodePlugin(),
      ],
    });

    expect(stats.compilation.errors).toEqual([]);

    // Two entries → two encode tasks went through the pool.
    expect(LynxEncodePlugin.encodePool.completed - completedBefore).toBe(2);

    // Pool grew to (or already had) at least two threads to run them in
    // parallel rather than serializing on a single worker.
    expect(LynxEncodePlugin.encodePool.threads.length).toBeGreaterThanOrEqual(
      2,
    );

    const { assets } = stats.toJson({ all: false, assets: true });
    expect(assets?.find(i => i.name === 'a.js')).not.toBeUndefined();
    expect(assets?.find(i => i.name === 'b.js')).not.toBeUndefined();
  });

  test('subsequent compile reuses warm workers (no respawn)', async () => {
    const warmIds = new Set(
      LynxEncodePlugin.encodePool.threads.map(t => t.threadId),
    );
    expect(warmIds.size).toBeGreaterThan(0);

    const completedBefore = LynxEncodePlugin.encodePool.completed;

    // Simulate a watch-mode rebuild: a fresh compiler instance against the
    // *same* process-wide pool.
    await runWebpack({
      context,
      mode: 'development',
      devtool: false,
      output: { iife: false, filename: '[name].js' },
      entry: { rebuild: './fixtures/basic.tsx' },
      plugins: [
        new LynxTemplatePlugin(),
        new LynxEncodePlugin(),
      ],
    });

    // The rebuild ran a task through the pool…
    expect(LynxEncodePlugin.encodePool.completed - completedBefore).toBe(1);

    // …but every thread currently in the pool was already warm from the
    // previous compile — none were newly spawned for the rebuild.
    for (const { threadId } of LynxEncodePlugin.encodePool.threads) {
      expect(warmIds.has(threadId)).toBe(true);
    }
  });
});
