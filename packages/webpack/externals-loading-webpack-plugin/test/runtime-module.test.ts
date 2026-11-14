// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
/* eslint-disable import/no-commonjs -- Execute emitted CommonJS modules in isolated VM realms. */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createContext, runInContext } from 'node:vm';
import type { Context } from 'node:vm';

import { rspack } from '@rspack/core';
import { afterAll, beforeAll, describe, expect, it } from '@rstest/core';

import { ExternalsLoadingPlugin } from '../src/index.js';
import type { ExternalValue } from '../src/index.js';

const layers = ['background', 'main-thread'] as const;

function createHost() {
  const requests: string[] = [];
  return {
    instances: 0,
    requests,
    resolveUrl: () =>
      Promise.resolve('https://dynamic.example/component.bundle'),
    fetchBundle(url: string) {
      requests.push(url);
      return {
        then(resolve: (response: object) => void) {
          queueMicrotask(() => resolve({ code: 0, url }));
        },
      };
    },
    loadScript(section: string, options: { bundleName: string }): unknown {
      return { value: `${options.bundleName}:${section}` };
    },
  };
}

describe('runtime loader modules', () => {
  let directory: string;
  const sources = new Map<string, string>();

  async function compile(mode: string, external: ExternalValue) {
    const compiler = rspack({
      mode: 'development',
      context: directory,
      target: 'node',
      resolve: { extensions: ['.ts', '.js', '.json'] },
      devtool: false,
      entry: Object.fromEntries(
        layers.map(layer => [layer, { import: './index.js', layer }]),
      ),
      module: {
        rules: [{
          test: /\.ts$/,
          loader: 'builtin:swc-loader',
          options: { jsc: { parser: { syntax: 'typescript' } } },
        }],
      },
      output: {
        path: path.join(directory, mode),
        filename: '[name].js',
        publicPath: 'https://cdn.example/',
        library: { type: 'commonjs2' },
      },
      plugins: [
        new ExternalsLoadingPlugin({
          mainThreadLayer: 'main-thread',
          backgroundLayer: 'background',
          externals: {
            component: external,
            other: { ...external, libraryName: 'Other' },
          },
        }),
      ],
    });
    await new Promise<void>((resolve, reject) =>
      compiler.run((error, stats) =>
        compiler.close(closeError => {
          if (error || closeError || stats?.hasErrors()) {
            reject(error ?? closeError ?? new Error(stats!.toString()));
          } else resolve();
        })
      )
    );
    for (const layer of layers) {
      sources.set(
        `${mode}:${layer}`,
        await fs.readFile(path.join(directory, mode, `${layer}.js`), 'utf8'),
      );
    }
  }

  beforeAll(async () => {
    directory = await fs.mkdtemp(
      path.join(os.tmpdir(), 'lynx-runtime-module-'),
    );
    await fs.writeFile(
      path.join(directory, 'index.js'),
      'export { value, instance, thread } from "component"; export { instance as otherInstance } from "other";',
    );
    await fs.writeFile(
      path.join(directory, 'fetch.ts'),
      `
export function fetchBundle(host: any, url: string) {
  return new Promise<any>((resolve, reject) => host.fetchBundle(url, {}).then(resolve, reject));
}
`,
    );
    await fs.writeFile(
      path.join(directory, 'runtime.ts'),
      `
import { fetchBundle } from './fetch.ts';
export default function createRuntime({ lynx: host, thread }) {
  const instance = ++host.instances;
  return {
    async load({ url, sectionPath }) {
      url ??= await host.resolveUrl();
      let response = await fetchBundle(host, url);
      if (response.code !== 0) response = await fetchBundle(host, url + '?cdn=1');
      const exports = await host.loadScript(sectionPath, { bundleName: response.url });
      return { ...exports, instance, thread };
    }
  };
}
`,
    );
    const external: ExternalValue = {
      runtime: './runtime.ts',
      async: true,
      background: { sectionPath: 'Component' },
      mainThread: { sectionPath: 'Component__main-thread' },
    };
    await compile('dynamic', external);
    await compile('fixed', {
      ...external,
      url: 'https://fixed.example/component.bundle',
      bundlePath: 'ignored.bundle',
    });
    await compile('relative', { ...external, bundlePath: '/component.bundle' });
    await compile('predicate', {
      ...external,
      runtime: undefined,
      url: 'https://fixed.example/component.bundle',
      async: ({ systemInfo }) => systemInfo['platform'] === 'web',
    });
  });

  afterAll(async () => {
    if (directory) await fs.rm(directory, { recursive: true, force: true });
  });

  function execute(
    mode: string,
    layer: string,
    host: object,
    sharedContext?: Context,
  ): Promise<Record<string, unknown>> {
    const module = { exports: {} as unknown };
    const context = sharedContext ?? createContext({});
    Object.assign(context, {
      module,
      exports: module.exports,
      lynx: host,
      __LoadStyleSheet: () => null,
    });
    runInContext(sources.get(`${mode}:${layer}`)!, context);
    return module.exports as Promise<Record<string, unknown>>;
  }

  it.each(layers)(
    'bundles imports and shares a factory instance between externals in %s',
    async layer => {
      const host = createHost();
      const exports = await execute('dynamic', layer, host);
      expect(exports).toMatchObject({
        instance: 1,
        otherInstance: 1,
        thread: layer === 'background' ? 'background' : 'mainThread',
        value: `https://dynamic.example/component.bundle:Component${
          layer === 'background' ? '' : '__main-thread'
        }`,
      });
      expect(host.instances).toBe(1);
    },
  );

  it('keeps containers isolated even when they share a background global', async () => {
    const first = createHost();
    const second = createHost();
    const shared = createContext({});
    const exports = await Promise.all([
      execute('dynamic', 'background', first, shared),
      execute('dynamic', 'background', second, shared),
    ]);
    expect(first.instances).toBe(1);
    expect(second.instances).toBe(1);
    expect(exports[0]).not.toBe(exports[1]);
  });

  it.each(['fixed', 'relative'])(
    'passes the %s configured address to the runtime module',
    async mode => {
      const host = createHost();
      host.resolveUrl = () => {
        throw new Error('configured URL must be used');
      };
      const url = mode === 'fixed'
        ? 'https://fixed.example/component.bundle'
        : 'https://cdn.example/component.bundle';
      expect(await execute(mode, 'background', host)).toHaveProperty(
        'value',
        `${url}:Component`,
      );
      expect(host.requests).toEqual([url, url]);
    },
  );

  it('keeps the importing entry pending until section evaluation completes', async () => {
    const host = createHost();
    let complete!: () => void;
    const loading = new Promise<void>(resolve => {
      complete = resolve;
    });
    host.loadScript = async () => {
      await loading;
      return { value: 'ready' };
    };
    let ready = false;
    const exports = Promise.resolve(execute('dynamic', 'main-thread', host))
      .then(value => {
        ready = true;
        return value;
      });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(ready).toBe(false);
    complete();
    expect(await exports).toHaveProperty('value', 'ready');
  });

  it('propagates URL and evaluation failures to the importing entry', async () => {
    const host = createHost();
    host.resolveUrl = () => Promise.reject(new Error('version unavailable'));
    await expect(execute('dynamic', 'background', host)).rejects.toThrow(
      'version unavailable',
    );
    const other = createHost();
    other.loadScript = () => {
      throw new Error('evaluation failed');
    };
    await expect(execute('dynamic', 'background', other)).rejects.toThrow(
      'evaluation failed',
    );
  });

  it('propagates a rejected fetch Promise through the importing entry', async () => {
    const host = createHost();
    host.fetchBundle = () => Promise.reject(new Error('fetch failed'));
    await expect(execute('dynamic', 'background', host)).rejects.toThrow(
      'fetch failed',
    );
  });

  it('propagates native fetch Promise rejection through the module loader', async () => {
    const host = createHost();
    host.fetchBundle = () => Promise.reject(new Error('fetch rejected'));
    await expect(execute('dynamic', 'background', host)).rejects.toThrow(
      'fetch rejected',
    );
  });

  it('adapts callback-only native handlers and recovers a failed response in the runtime module', async () => {
    const host = createHost();
    host.fetchBundle = url => {
      host.requests.push(url);
      return {
        then(resolve) {
          queueMicrotask(() =>
            resolve({ code: url.includes('?cdn') ? 0 : 24, url })
          );
        },
      };
    };
    expect(await execute('dynamic', 'background', host)).toHaveProperty(
      'value',
      'https://dynamic.example/component.bundle?cdn=1:Component',
    );
  });

  it.each(['web', 'Android'])(
    'preserves the pure async predicate for %s',
    async platform => {
      const host = {
        SystemInfo: { platform },
        fetchBundle: (url: string) => ({
          then(resolve: (response: object) => void) {
            queueMicrotask(() => resolve({ code: 0, url }));
          },
          wait: () => ({ code: 0, url }),
        }),
        loadScript: () => ({ value: 'native' }),
      };
      expect(await execute('predicate', 'background', host)).toHaveProperty(
        'value',
        'native',
      );
    },
  );

  it('rejects configuration callbacks instead of serializing their closure', () => {
    const external = {
      url: () => 'https://example.com/component.bundle',
    } as unknown as ExternalValue;
    expect(() =>
      new ExternalsLoadingPlugin({
        mainThreadLayer: 'main-thread',
        backgroundLayer: 'background',
        externals: { component: external },
      })
    ).toThrow('runtime module');
  });

  it('rejects synchronous runtime-module loading', () => {
    expect(() =>
      new ExternalsLoadingPlugin({
        mainThreadLayer: 'main-thread',
        backgroundLayer: 'background',
        externals: { component: { runtime: './runtime.ts', async: false } },
      })
    ).toThrow('async: true');
  });

  it('rejects a runtime importing its own managed external instead of hanging startup', async () => {
    await fs.writeFile(
      path.join(directory, 'cycle.js'),
      'import "component"; export default () => ({ load() {} });',
    );
    await expect(
      compile('cycle', {
        runtime: './cycle.js',
        background: { sectionPath: 'Component' },
      }),
    ).rejects.toThrow('cannot import runtime-managed external');
  });
});
