// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { Compiler, Stats, Watching } from '@rspack/browser';

import { toDiagnostic } from './diagnostics.js';
import type { StatsDiagnostic } from './diagnostics.js';
import {
  applyChanges,
  assertChanges,
  listFiles,
  readFile,
  writeFiles,
} from './files.js';
import type { ProjectFs } from './files.js';
import { host } from './node/host.js';
import { setup } from './setup.js';
import type {
  AssetInfo,
  BuildEvent,
  BuildResult,
  CardInfo,
  Diagnostic,
  FileChange,
  OutputAsset,
  WebBundler,
  WebBundlerOptions,
} from './types.js';
import { ChangeWatchFileSystem } from './watch.js';

let bundlerCount = 0;

function validateOptions(options: WebBundlerOptions): void {
  // Entry names name output files: `../` would write outside the output
  // directory.
  for (const name of Object.keys(options.entries)) {
    if (!/^[\w.-]+$/.test(name)) {
      throw new TypeError(
        `Invalid entry name "${name}": use letters, digits, "_", "-" and "."`,
      );
    }
  }
  // Without it, the built code requests its assets from wrong URLs.
  if (!options.publicPath.endsWith('/')) {
    throw new TypeError('publicPath must be a string that ends with "/"');
  }
}

/** Creates the bundler; see `createWebBundler` in index.ts. */
export async function createWebBundlerImpl(
  options: WebBundlerOptions,
): Promise<WebBundler> {
  validateOptions(options);
  const rspack = await setup();
  const fs = rspack.builtinMemFs.fs as unknown as ProjectFs & {
    readFileSync(path: string): Uint8Array;
  };

  const id = ++bundlerCount;
  const root = id === 1 ? '/project' : `/project-${id}`;
  const outputDir = `/.web-bundle-kit/${id}/dist`;
  fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(root, { recursive: true });
  writeFiles(fs, root, options.files ?? {});

  const mode = options.mode ?? 'development';
  const hmr = mode === 'development' && (options.hmr ?? true);
  const entries = { ...options.entries };

  const [{ createRsbuild }, { pluginLynx }, { pluginReactLynx }] = await Promise
    .all([
      import('@rsbuild/core'),
      import('@lynx-js/rsbuild-plugin'),
      import('@lynx-js/react-rsbuild-plugin'),
    ]);

  const rsbuild = await createRsbuild({
    cwd: root,
    loadEnv: false,
    config: {
      mode,
      source: {
        entry: Object.fromEntries(
          Object.entries(entries).map(([name, entry]) => [name, `./${entry}`]),
        ),
      },
      // pluginLynx encodes `*.web.bundle` in an environment named `web`.
      environments: { web: {} },
      output: {
        distPath: { root: outputDir },
        assetPrefix: options.publicPath,
        cleanDistPath: false,
        polyfill: 'off',
        charset: 'utf8',
      },
      dev: {
        hmr,
        liveReload: hmr,
        assetPrefix: options.publicPath,
        progressBar: false,
      },
      // A host keeps pluginLynx from looking up a LAN address with node:os;
      // the kit never starts a server.
      server: { host: 'localhost', printUrls: false },
      performance: { printFileSize: false, buildCache: false },
      splitChunks: false,
      tools: {
        bundlerChain(chain) {
          // Use LynxTransportClient (lynx.getDevtool()) instead of a
          // WebSocket for hot updates; the embedder delivers the messages.
          chain.plugins.delete('lynx.hmr.provide.dev_server_client');
        },
      },
      plugins: [pluginLynx(), pluginReactLynx()],
    },
  });

  const compiler = (await rsbuild.createCompiler()) as unknown as Compiler;
  // Loaders are bundled into the kit; Rspack gets them by the path it
  // resolved in memfs, which is where their placeholders are mirrored.
  new rspack.BrowserRequirePlugin({
    modules: (id: string) => host.modules[id],
  }).apply(compiler);
  const watchFileSystem = new ChangeWatchFileSystem(compiler);
  compiler.watchFileSystem =
    watchFileSystem as unknown as Compiler['watchFileSystem'];

  let previous = new Map<string, Uint8Array>();
  let watching: Watching | undefined;
  let closed = false;

  function toResult(stats: Stats): BuildResult {
    const json = stats.toJson(
      {
        all: false,
        errors: true,
        warnings: true,
        hash: true,
        timings: true,
        colors: false,
      } as Parameters<Stats['toJson']>[0],
    );
    const [errors, warnings] = [json.errors, json.warnings].map((list) =>
      (list ?? []).map((e) => toDiagnostic(root, e as StatsDiagnostic))
    ) as [Diagnostic[], Diagnostic[]];

    const current = new Map<string, Uint8Array>();
    const assets: AssetInfo[] = [];
    const emitted: OutputAsset[] = [];
    for (const asset of stats.compilation.getAssets()) {
      const buffer = asset.source.buffer();
      const content = new Uint8Array(
        buffer.buffer,
        buffer.byteOffset,
        buffer.byteLength,
      ).slice();
      current.set(asset.name, content);
      assets.push({ name: asset.name, size: content.byteLength });
      const before = previous.get(asset.name);
      if (!before || !sameBytes(before, content)) {
        emitted.push({ name: asset.name, content });
      }
    }
    previous = current;
    assets.sort((a, b) => a.name.localeCompare(b.name));
    emitted.sort((a, b) => a.name.localeCompare(b.name));

    const cards: CardInfo[] = errors.length > 0
      ? []
      : Object.entries(entries).flatMap(([name, entry]) => {
        const bundle = `${name}.web.bundle`;
        return current.has(bundle) ? [{ name, entry, bundle }] : [];
      });
    return {
      hash: json.hash ?? '',
      durationMs: (stats.endTime ?? 0) - (stats.startTime ?? 0),
      errors,
      warnings,
      cards,
      assets,
      emitted,
    };
  }

  function assertOpen(): void {
    if (closed) throw new Error('This bundler is closed');
  }

  return {
    async applyChanges(changes: FileChange[]): Promise<void> {
      assertOpen();
      assertChanges(changes);
      const applied = applyChanges(fs, root, changes);
      watchFileSystem.notify(applied.changed, applied.removed);
    },

    async readFile(path: string): Promise<Uint8Array | undefined> {
      assertOpen();
      return readFile(fs, root, path);
    },

    async listFiles(): Promise<string[]> {
      assertOpen();
      return listFiles(fs, root);
    },

    build(): Promise<BuildResult> {
      assertOpen();
      // Rspack reports a build while another one runs, or while watching,
      // as the error of this one.
      return new Promise<BuildResult>((resolve) => {
        compiler.run((error, stats) => {
          resolve(error || !stats ? failure(error) : toResult(stats));
        });
      });
    },

    watch(listener: (event: BuildEvent) => void): Promise<void> {
      assertOpen();
      if (watching) {
        return Promise.reject(new Error('This bundler is already watching'));
      }
      return new Promise<void>((resolve) => {
        let first = true;
        compiler.hooks.watchRun.tap('web-bundle-kit', () => {
          listener({ type: 'start' });
        });
        watching = compiler.watch({ aggregateTimeout: 0 }, (error, stats) => {
          listener({
            type: 'done',
            result: error || !stats ? failure(error) : toResult(stats),
          });
          if (first) {
            first = false;
            resolve();
          }
        });
      });
    },

    async close(): Promise<void> {
      if (closed) return;
      closed = true;
      if (watching) {
        await new Promise<void>((resolve) => watching!.close(() => resolve()));
      }
      await new Promise<void>((resolve) => compiler.close(() => resolve()));
      fs.rmSync(root, { recursive: true, force: true });
      fs.rmSync(outputDir, { recursive: true, force: true });
    },
  };
}

/** The result of a compilation that did not finish. */
function failure(error: unknown): BuildResult {
  const message = error instanceof Error
    ? (error.stack ?? error.message)
    : String(error);
  return {
    hash: '',
    durationMs: 0,
    errors: [{ message }],
    warnings: [],
    cards: [],
    assets: [],
    emitted: [],
  };
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) return false;
  for (let i = 0; i < a.byteLength; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
