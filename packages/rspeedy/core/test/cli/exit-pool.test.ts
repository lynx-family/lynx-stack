// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'

import { expect, test } from '@rstest/core'

test.each([false, true])(
  'CLI terminates encode workers before flushing stdio (encode=%s)',
  async (encode) => {
    const directory = await mkdtemp(join(tmpdir(), 'rspeedy-exit-pool-'))
    const poolModule = pathToFileURL(resolve(
      __dirname,
      '../../../../webpack/template-webpack-plugin/lib/index.js',
    )).href
    // Read the real shared pool at exit. No stream mocks or listener-limit changes.
    const observer = `
    const { isMainThread } = await import('node:worker_threads');
    if (isMainThread) {
      const { LynxEncodePlugin } = await import(${JSON.stringify(poolModule)});
      const pool = LynxEncodePlugin.encodePool;
      const workers = [...pool.threads];
      let stopped = 0;
      for (const worker of workers) worker.once('exit', () => { stopped++; });
      process.once('exit', () => {
        console.log('EXIT_POOL_STATE=' + JSON.stringify({
          started: workers.length,
          completed: pool.completed,
          remaining: pool.threads.length,
          stopped,
        }));
      });
    }
  `
    try {
      await Promise.all([
        writeFile(join(directory, 'package.json'), '{"type":"module"}'),
        writeFile(
          join(directory, 'lynx.config.mjs'),
          encode
            ? `import { LynxTemplatePlugin, LynxEncodePlugin } from ${
              JSON.stringify(poolModule)
            };
             export default {
               source: { entry: './index.js' },
               tools: { rspack: { plugins: [
                 new LynxTemplatePlugin({ filename: '[name].lynx.bundle' }),
                 new LynxEncodePlugin(),
               ] } },
             };`
            : 'export default { source: { entry: "./index.js" } };',
        ),
        writeFile(
          join(directory, 'index.js'),
          'console.log("exit-pool-build");',
        ),
      ])
      const { stdout, stderr } = await promisify(execFile)(process.execPath, [
        '--trace-warnings',
        '--import',
        `data:text/javascript,${encodeURIComponent(observer)}`,
        resolve(__dirname, '../../bin/rspeedy.js'),
        'build',
      ], {
        cwd: directory,
        env: {
          ...process.env,
          NODE_OPTIONS: '',
          NODE_NO_WARNINGS: '',
          NODE_ENV: 'production',
          CI: 'true',
          RSDOCTOR: 'false',
        },
        timeout: 30_000,
      })
      if (encode) {
        const bundle = await readFile(join(directory, 'dist/main.lynx.bundle'))
        expect(bundle.byteLength).toBeGreaterThan(0)
      } else {
        const assets = join(directory, 'dist/static/js')
        const files = await readdir(assets)
        const programs = await Promise.all(
          files.filter(file => file.endsWith('.js'))
            .map(file => readFile(join(assets, file), 'utf8')),
        )
        expect(programs.some(program => program.includes('exit-pool-build')))
          .toBe(
            true,
          )
      }
      const stateText = /EXIT_POOL_STATE=(\{[^\n]+\})/.exec(stdout)?.[1]
      expect(stateText).toBeDefined()
      const state = JSON.parse(stateText!) as {
        started: number
        completed: number
        remaining: number
        stopped: number
      }
      // Require real workers first: a test that never started a pool is vacuous.
      expect(state.started).toBeGreaterThan(0)
      if (encode) expect(state.completed).toBeGreaterThan(0)
      else expect(state.completed).toBe(0)
      expect(state.remaining).toBe(0)
      expect(state.stopped).toBe(state.started)
      expect(stderr).not.toContain('MaxListenersExceededWarning')
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  },
  40_000,
)
