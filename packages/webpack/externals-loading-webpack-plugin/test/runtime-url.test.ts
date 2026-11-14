// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
/* eslint-disable import/no-commonjs -- Execute emitted CommonJS modules in isolated VM realms. */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runInNewContext } from 'node:vm';

import { rspack } from '@rspack/core';
import { afterAll, beforeAll, describe, expect, it } from '@rstest/core';

import { ExternalsLoadingPlugin } from '../src/index.js';
import type { ExternalValue } from '../src/index.js';

const resolver = () =>
  (globalThis as unknown as { bundleUrl: string | Promise<string> })
    .bundleUrl;

describe('runtime bundle URLs', () => {
  let directory: string;
  const sources = new Map<string, string>();

  beforeAll(async () => {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'lynx-runtime-url-'));
    await fs.writeFile(
      path.join(directory, 'index.js'),
      'export { value } from "component";',
    );
    for (const custom of [false, true, 'method', 'async-method'] as const) {
      const external: ExternalValue = {
        url: resolver,
        async: true,
        background: { sectionPath: 'Component' },
        mainThread: { sectionPath: 'Component__main-thread' },
        ...(custom
          ? {
            load: (response, section) =>
              (globalThis as unknown as {
                evaluateBundle: (response: unknown, section: string) => unknown;
              }).evaluateBundle(response, section),
          }
          : {}),
      };
      if (custom === 'method' || custom === 'async-method') {
        const methods = {
          url(this: void) {
            return (globalThis as unknown as { bundleUrl: string }).bundleUrl;
          },
          load(this: void, response: unknown, section: string) {
            return (globalThis as unknown as {
              evaluateBundle: (response: unknown, section: string) => unknown;
            }).evaluateBundle(response, section);
          },
        };
        // Async methods must also be independent of build-time closures.
        if (custom === 'async-method') {
          external.url = {
            async url(this: void) {
              return await Promise.resolve(
                (globalThis as unknown as { bundleUrl: string }).bundleUrl,
              );
            },
          }.url;
          external.load = {
            async load(this: void, response: unknown, section: string) {
              return await Promise.resolve((globalThis as unknown as {
                evaluateBundle: (response: unknown, section: string) => unknown;
              }).evaluateBundle(response, section));
            },
          }.load;
        } else {
          external.url = methods.url;
          external.load = methods.load;
        }
      }
      const output = path.join(directory, String(custom));
      await new Promise<void>((resolve, reject) => {
        const compiler = rspack({
          mode: 'development',
          context: directory,
          target: 'node',
          devtool: false,
          entry: Object.fromEntries(
            ['background', 'main-thread'].map(
              layer => [layer, { import: './index.js', layer }],
            ),
          ),
          output: {
            path: output,
            filename: '[name].js',
            publicPath: '',
            library: { type: 'commonjs2' },
          },
          plugins: [
            new ExternalsLoadingPlugin({
              mainThreadLayer: 'main-thread',
              backgroundLayer: 'background',
              externals: { component: external },
            }),
          ],
        });
        compiler.run((error, stats) =>
          compiler.close(closeError => {
            if (error) reject(error);
            else if (closeError) reject(closeError);
            else if (stats?.hasErrors()) reject(new Error(stats.toString()));
            else resolve();
          })
        );
      });
      for (const layer of ['background', 'main-thread']) {
        sources.set(
          `${custom}:${layer}`,
          await fs.readFile(path.join(output, `${layer}.js`), 'utf8'),
        );
      }
    }
  });

  afterAll(async () => {
    if (directory) await fs.rm(directory, { recursive: true, force: true });
  });

  it.each(['background', 'main-thread'])(
    'resolves a URL independently in %s using callback-only native handlers',
    async layer => {
      let complete!: (url: string) => void;
      const bundleUrl = new Promise<string>(resolve => {
        complete = resolve;
      });
      const requests: string[] = [];
      const module = { exports: {} };
      runInNewContext(sources.get(`false:${layer}`)!, {
        module,
        exports: module.exports,
        bundleUrl,
        lynx: {
          fetchBundle(url: string) {
            requests.push(url);
            return {
              then(callback: (response: unknown) => void) {
                queueMicrotask(() => callback({ code: 0, url }));
              },
            };
          },
          loadScript(section: string, { bundleName }: { bundleName: string }) {
            return { value: `${bundleName}:${section}` };
          },
        },
        __LoadStyleSheet: () => null,
      });
      expect(requests).toEqual([]);
      complete(`https://cdn.example/${layer}/component.bundle`);
      expect(await Promise.resolve(module.exports)).toHaveProperty(
        'value',
        `https://cdn.example/${layer}/component.bundle:Component${
          layer === 'main-thread' ? '__main-thread' : ''
        }`,
      );
      expect(requests).toEqual([
        `https://cdn.example/${layer}/component.bundle`,
      ]);
    },
  );

  it.each(['background', 'main-thread'])(
    'propagates URL rejection without fetching in %s',
    async layer => {
      const module = { exports: {} };
      runInNewContext(sources.get(`false:${layer}`)!, {
        module,
        exports: module.exports,
        bundleUrl: Promise.reject(new Error('version unavailable')),
        lynx: {
          fetchBundle() {
            throw new Error('must not fetch');
          },
        },
      });
      await expect(module.exports).rejects.toThrow('version unavailable');
    },
  );

  it.each(['background', 'main-thread'])(
    'lets a custom loader recover failed responses in %s',
    async layer => {
      const module = { exports: {} };
      runInNewContext(sources.get(`true:${layer}`)!, {
        module,
        exports: module.exports,
        bundleUrl: 'https://cdn.example/component.bundle',
        lynx: {
          fetchBundle(url: string) {
            return {
              then(callback: (response: unknown) => void) {
                queueMicrotask(() => callback({ code: 24, url }));
              },
            };
          },
        },
        evaluateBundle(response: { code: number }, section: string) {
          return Promise.resolve({ value: `${response.code}:${section}` });
        },
      });
      expect(await Promise.resolve(module.exports)).toHaveProperty(
        'value',
        `24:Component${layer === 'main-thread' ? '__main-thread' : ''}`,
      );
    },
  );

  it.each(['method', 'async-method'])(
    'executes %s URL and loader callbacks in the emitted runtime',
    async custom => {
      const module = { exports: {} };
      runInNewContext(sources.get(`${custom}:main-thread`)!, {
        module,
        exports: module.exports,
        bundleUrl: 'https://cdn.example/component.bundle',
        lynx: { fetchBundle: (url: string) => Promise.resolve({ url }) },
        evaluateBundle: (response: { url: string }, section: string) => ({
          value: `${response.url}:${section}`,
        }),
      });
      expect(await Promise.resolve(module.exports)).toHaveProperty(
        'value',
        'https://cdn.example/component.bundle:Component__main-thread',
      );
    },
  );

  it('propagates native fetch rejection to the importing module', async () => {
    const module = { exports: {} };
    runInNewContext(sources.get('false:background')!, {
      module,
      exports: module.exports,
      bundleUrl: 'https://cdn.example/component.bundle',
      lynx: {
        fetchBundle: () => Promise.reject(new Error('bundle unavailable')),
      },
    });
    await expect(module.exports).rejects.toThrow('bundle unavailable');
  });

  it('rejects runtime resolvers configured for synchronous loading', () => {
    expect(() =>
      new ExternalsLoadingPlugin({
        mainThreadLayer: 'main-thread',
        backgroundLayer: 'background',
        externals: { component: { url: resolver, async: false } },
      })
    ).toThrow('async: true');
  });
});
