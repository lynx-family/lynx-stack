// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * The bundler worker: a dedicated module Worker that owns one `WebBundler` of
 * `@lynx-js/web-bundle-kit` at a time and speaks the messages of
 * `./messages.ts` with the page. The logic is in `./host.ts`.
 */

import type * as BundleKit from '@lynx-js/web-bundle-kit';

import { writeAssets } from '../shared/assets.js';
import { BundlerHost } from './host.js';
import type { WorkerCommand, WorkerEvent } from './messages.js';

/**
 * Where the build of the kit puts the `dist/` of `@lynx-js/web-bundle-kit`,
 * relative to this worker. The bundle kit is not bundled into the worker: it
 * loads its own chunks, Rspack's wasm and the mirror of its packages from
 * next to its entry, so it is copied as it is and imported at run time.
 */
export const BUNDLE_KIT_PATH = './bundle-kit/index.js';

// The worker's own URL is the base: `import.meta.url` would make Rspack try
// to bundle the path.
const bundleKitUrl = new URL(BUNDLE_KIT_PATH, self.location.href).href;
const bundleKit = import(
  /* webpackIgnore: true */ bundleKitUrl
) as Promise<typeof BundleKit>;

const scope = self as unknown as DedicatedWorkerGlobalScope;

function post(message: WorkerEvent): void {
  scope.postMessage(message);
}

const host = new BundlerHost({
  createWebBundler: async options =>
    (await bundleKit).createWebBundler(options),
  writeAssets,
  post,
});

scope.addEventListener('message', (event: MessageEvent<WorkerCommand>) => {
  void host.receive(event.data);
});

bundleKit.then(
  kit => post({ type: 'ready', builtinPackages: kit.builtinPackages }),
  (error: unknown) =>
    post({
      type: 'ready',
      builtinPackages: {},
      error: `Cannot load @lynx-js/web-bundle-kit: ${String(error)}`,
    }),
);
