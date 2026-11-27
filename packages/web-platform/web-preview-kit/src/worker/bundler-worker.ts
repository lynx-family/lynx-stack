// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * The bundler worker: a module Worker that owns one `WebBundler` of
 * `@lynx-js/web-bundle-kit` at a time, writes the assets of every build to
 * CacheStorage, and only then reports the build to the page.
 *
 * The page sends one command at a time, so commands never overlap.
 *
 * Revisions: `applyChanges` writes a batch to the bundler's file system
 * synchronously, so a compilation that starts after the call began sees all
 * of it. A build is labelled with the latest revision recorded when it
 * starts; batches that arrive while a compilation runs are merged into the
 * next one, which is labelled with the newest of them.
 */

import type * as BundleKit from '@lynx-js/web-bundle-kit';
import type { FileMap, OutputAsset, WebBundler } from '@lynx-js/web-bundle-kit';

import { CARDS_DIRECTORY } from '../shared/assets.js';
import type {
  BuildReport,
  BundlerConfig,
  WorkerCommand,
  WorkerEvent,
} from './messages.js';

// The build of the kit copies the `dist/` of the bundle kit to `bundle-kit/`
// as it is: it loads its own chunks, Rspack's wasm and its package mirror
// from next to its entry. The worker's URL is the base, because
// `import.meta.url` would make Rspack try to bundle the path.
const bundleKit = import(
  /* webpackIgnore: true */ new URL('./bundle-kit/index.js', self.location.href)
    .href
) as Promise<typeof BundleKit>;

const scope = self as unknown as DedicatedWorkerGlobalScope;

interface Current {
  bundler: WebBundler;
  generation: number;
}

let current: Current | undefined;
let latestRevision = 0;

function post(message: WorkerEvent): void {
  scope.postMessage(message);
}

scope.addEventListener(
  'message',
  async ({ data }: MessageEvent<WorkerCommand & { id: number }>) => {
    try {
      post({ type: 'reply', id: data.id, result: await handle(data) });
    } catch (error) {
      post({
        type: 'reply',
        id: data.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
);

async function handle(command: WorkerCommand): Promise<unknown> {
  switch (command.type) {
    case 'start': {
      const files = command.files ?? await snapshot(current!.bundler);
      await close();
      latestRevision = command.revision;
      const { entries, publicPath } = command.config;
      const bundler = await (await bundleKit).createWebBundler({
        entries,
        publicPath,
        files,
      });
      current = { bundler, generation: command.generation };
      watch(current, command.config);
      return undefined;
    }
    case 'apply':
      latestRevision = command.revision;
      return current!.bundler.applyChanges(command.changes);
    case 'read':
      return current!.bundler.readFile(command.path);
    case 'list':
      return current!.bundler.listFiles();
    case 'close':
      return close();
  }
}

async function close(): Promise<void> {
  const previous = current;
  current = undefined;
  await previous?.bundler.close();
}

async function snapshot(bundler: WebBundler): Promise<FileMap> {
  const files: FileMap = {};
  for (const path of await bundler.listFiles()) {
    files[path] = (await bundler.readFile(path))!;
  }
  return files;
}

function watch(target: Current, config: BundlerConfig): void {
  const { generation } = target;
  let revision = latestRevision;
  // Reports are chained so that a build starts after the previous one is
  // reported, which waits for its assets to be stored.
  let reporting = Promise.resolve();
  void target.bundler.watch((event) => {
    if (event.type === 'start') {
      revision = latestRevision;
      const started = revision;
      reporting = reporting.then(() => {
        post({ type: 'build-start', generation, revision: started });
      });
      return;
    }
    const built = revision;
    const { emitted, ...report } = event.result;
    reporting = reporting.then(async () => {
      // A closed bundler must not write into the cache of the next project.
      if (current !== target) {
        return;
      }
      await store(emitted, report, config);
      post({ type: 'build-done', generation, revision: built, report });
    });
  });
}

/**
 * Writes the emitted assets, removes the hot-update files of earlier builds,
 * and copies the card bundles of a successful build to `CARDS_DIRECTORY`.
 */
async function store(
  emitted: OutputAsset[],
  report: BuildReport,
  { publicPath, cacheName }: BundlerConfig,
): Promise<void> {
  const cache = await caches.open(cacheName);
  const urlOf = (name: string) => new URL(name, publicPath).href;
  await Promise.all(emitted.map(({ name, content }) =>
    cache.put(
      urlOf(name),
      new Response(content as Uint8Array<ArrayBuffer>, {
        headers: { 'Content-Type': contentTypeOf(name) },
      }),
    )
  ));
  const listed = new Set(report.assets.map(asset => urlOf(asset.name)));
  for (const request of await cache.keys()) {
    if (/\.hot-update\.[^/]+$/.test(request.url) && !listed.has(request.url)) {
      await cache.delete(request);
    }
  }
  for (const { bundle } of report.cards) {
    const copy = new URL(bundle, urlOf(CARDS_DIRECTORY)).href;
    await cache.put(copy, (await cache.match(urlOf(bundle)))!);
  }
}

const CONTENT_TYPES: Record<string, string> = {
  js: 'text/javascript; charset=utf-8',
  mjs: 'text/javascript; charset=utf-8',
  cjs: 'text/javascript; charset=utf-8',
  json: 'application/json; charset=utf-8',
  map: 'application/json; charset=utf-8',
  css: 'text/css; charset=utf-8',
  html: 'text/html; charset=utf-8',
  txt: 'text/plain; charset=utf-8',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  ico: 'image/x-icon',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  otf: 'font/otf',
  wasm: 'application/wasm',
};

function contentTypeOf(name: string): string {
  const extension = /\.([^./]+)$/.exec(name)?.[1]?.toLowerCase() ?? '';
  return CONTENT_TYPES[extension] ?? 'application/octet-stream';
}
