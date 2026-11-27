// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// What each Node.js built-in becomes in the kit: the options of
// `pluginNodePolyfill` (@rsbuild/plugin-node-polyfill). A built-in is one of:
//
// - the plugin's own polyfill, an npm package;
// - an override: a module of `src/node`, the kit's own implementation;
// - an empty module, when nothing in the kit's build runs it.
//
// `builtinModules` in src/node/module.ts lists the built-ins that are not
// empty.

import { builtinModules } from 'node:module';
import path from 'node:path';

import { getResolveFallback } from '@rsbuild/plugin-node-polyfill';
import type { PluginNodePolyfillOptions } from '@rsbuild/plugin-node-polyfill';

/** Built-ins that get the plugin's polyfill. */
export const polyfilled = [
  'assert',
  'events',
  'querystring',
  'stream',
  'string_decoder',
  'tty',
  'zlib',
] as const;

/** Built-ins that get a module of `src/node`, relative to the package. */
export const overridden: Record<string, string> = {
  // The memfs of @rspack/browser and what goes with it.
  buffer: 'src/node/buffer.ts',
  fs: 'src/node/fs.ts',
  'fs/promises': 'src/node/fs-promises.ts',
  module: 'src/node/module.ts',
  // Installed as a global only by `setup()`, after @rspack/browser has
  // loaded; it has no `versions.node`.
  process: 'src/node/process.ts',
  // `sha1` and `sha256` with @noble/hashes.
  crypto: 'src/node/crypto.ts',
  // The plugin's polyfills lack members that bundled code uses:
  // `path.win32` and `path.toNamespacedPath`, `util.styleText` and others,
  // `fileURLToPath`, `os.availableParallelism`.
  path: 'src/node/path.ts',
  'path/posix': 'src/node/path.ts',
  url: 'src/node/url.ts',
  util: 'src/node/util.ts',
  'util/types': 'src/node/util-types.ts',
  os: 'src/node/os.ts',
  // Functions that throw, which bundled code imports by name.
  child_process: 'src/node/child-process.ts',
  // `isIP` and the like.
  net: 'src/node/net.ts',
};

/**
 * The options of `pluginNodePolyfill`. `root` is the package directory.
 *
 * `include` names every built-in: the plugin only applies `overrides` to the
 * built-ins it includes, and makes an included built-in that it has no
 * polyfill for an empty module. The plugin's polyfills for built-ins that are
 * neither polyfilled nor overridden here (`http`, `timers`, ...) are replaced
 * with empty modules, as they would only add code that never runs.
 */
export function nodePolyfillOptions(root: string): PluginNodePolyfillOptions {
  const include = builtinModules.filter((name) => !name.startsWith('_'));
  const overrides: Record<string, string | false> = {};
  for (const name of include) {
    if (Object.hasOwn(overridden, name)) {
      overrides[name] = path.join(root, overridden[name]!);
    } else if (!(polyfilled as readonly string[]).includes(name)) {
      overrides[name] = false;
    }
  }
  return {
    include,
    overrides,
    // `setup()` installs the `Buffer` and `process` globals
    // (src/node/globals.ts) once @rspack/browser has loaded. Provided to
    // every module, `process` would also reach the wasm runtime of
    // @rspack/browser, whose `typeof process` checks take it for Node.js.
    globals: { Buffer: false, process: false },
    // The plugin strips `node:` before resolution: Rspack reads it as a URL
    // scheme otherwise.
    protocolImports: true,
  };
}

/**
 * Exact aliases with the targets of the `resolve.fallback` that
 * `pluginNodePolyfill` sets. A fallback only applies when a request does not
 * resolve, and a bundled package may reach an npm package of the same name
 * (pnpm hoists `url`, `util`, `process` and others into
 * `node_modules/.pnpm/node_modules`); an alias applies to every request.
 * `node:` is stripped before resolution, so the `node:` entries are left out.
 */
export function builtinAliases(
  options: PluginNodePolyfillOptions,
): Record<string, string | false> {
  return Object.fromEntries(
    Object.entries(getResolveFallback(options))
      .filter(([name]) => !name.startsWith('node:'))
      .map(([name, target]) => [`${name}$`, target]),
  );
}
