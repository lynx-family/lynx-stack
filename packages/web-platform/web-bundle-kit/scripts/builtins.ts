// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// What the kit's build aliases each Node.js built-in to: a stand-in in
// `src/node` (a path relative to the package), or an npm package. Built-ins
// that are not listed have no stand-in; the build makes them empty modules.
// `builtinModules` in src/node/module.ts lists the same names.

import { builtinModules, createRequire } from 'node:module';
import path from 'node:path';

/** A stand-in: a path relative to the package, or an npm module. */
export type StandIn = string | { package: string };

export const standIns: Record<string, StandIn> = {
  assert: 'src/node/assert.ts',
  buffer: 'src/node/buffer.ts',
  child_process: 'src/node/child-process.ts',
  crypto: 'src/node/crypto.ts',
  // The npm package. Bundled code only imports `EventEmitter` and `once` from
  // it by name, and CommonJS code that requires it gets the class itself.
  events: { package: 'events/events.js' },
  fs: 'src/node/fs.ts',
  'fs/promises': 'src/node/fs-promises.ts',
  module: 'src/node/module.ts',
  net: 'src/node/net.ts',
  os: 'src/node/os.ts',
  path: 'src/node/path.ts',
  'path/posix': 'src/node/path.ts',
  perf_hooks: 'src/node/perf-hooks.ts',
  process: 'src/node/process.ts',
  querystring: 'src/node/querystring.ts',
  readline: 'src/node/readline.ts',
  stream: 'src/node/stream.ts',
  string_decoder: 'src/node/string-decoder.ts',
  tty: 'src/node/tty.ts',
  url: 'src/node/url.ts',
  util: 'src/node/util.ts',
  'util/types': 'src/node/util-types.ts',
  v8: 'src/node/v8.ts',
  vm: 'src/node/vm.ts',
  worker_threads: 'src/node/worker-threads.ts',
  zlib: 'src/node/zlib.ts',
};

/**
 * The `resolve.alias` entries for the built-ins: each goes to its stand-in, or
 * to an empty module (`false`) when it has none. `root` is the package
 * directory.
 */
export function builtinAliases(root: string): Record<string, string | false> {
  const require = createRequire(path.join(root, 'package.json'));
  const alias: Record<string, string | false> = {};
  for (const name of builtinModules.filter((n) => !n.startsWith('_'))) {
    const standIn = Object.hasOwn(standIns, name) ? standIns[name] : undefined;
    alias[`${name}$`] = standIn === undefined
      ? false
      : typeof standIn === 'string'
      ? path.join(root, standIn)
      : require.resolve(standIn.package);
  }
  return alias;
}
