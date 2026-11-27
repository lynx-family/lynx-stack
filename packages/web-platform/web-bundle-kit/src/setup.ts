// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { registered } from '../generated/registered.js';
import { installGlobals } from './node/globals.js';
import { host } from './node/host.js';

declare const __webpack_public_path__: string;

type RspackBrowser = typeof import('@rspack/browser');

interface Mirror {
  files: Record<string, string>;
}

let ready: Promise<RspackBrowser> | undefined;

/**
 * Loads Rspack, fills `/node_modules` in memfs with the mirror and connects
 * the Node.js stand-ins to them. Runs once per Worker.
 */
export function setup(): Promise<RspackBrowser> {
  ready ??= (async () => {
    if (!globalThis.crossOriginIsolated) {
      throw new Error(
        '@lynx-js/web-bundle-kit needs a cross-origin isolated page '
          + '(Cross-Origin-Opener-Policy: same-origin and '
          + 'Cross-Origin-Embedder-Policy: require-corp)',
      );
    }
    const [rspack, mirror] = await Promise.all([
      import('@rspack/browser'),
      fetch(new URL('mirror.json', __webpack_public_path__)).then(
        async (response) => {
          if (!response.ok) {
            throw new Error(
              `Failed to load ${response.url}: ${response.status}`,
            );
          }
          return (await response.json()) as Mirror;
        },
      ),
    ]);
    // After @rspack/browser has started: its wasm runtime looks at
    // `process` to tell Node.js from a browser.
    installGlobals('/');
    host.fs = rspack.builtinMemFs.fs;
    host.ResolverFactory = rspack.experiments.resolver.ResolverFactory;
    rspack.builtinMemFs.volume.fromJSON(mirror.files);
    await Promise.all(
      Object.entries(registered).map(async ([path, load]) => {
        host.modules[path] = await load();
      }),
    );
    return rspack;
  })();
  return ready;
}
