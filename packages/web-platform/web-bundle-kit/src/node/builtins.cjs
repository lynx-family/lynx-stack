// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// Every Node.js built-in and what stands in for it in the kit. The kit's build
// aliases each built-in to the same module, and `require()` from
// `createRequire` returns them from here.

const trap = require('./trap.cjs');

const builtins = {
  assert: require('./assert.cjs'),
  buffer: require('./buffer.cjs'),
  child_process: trap('node:child_process'),
  crypto: require('./crypto.cjs'),
  // The npm package; a bare 'events' would come back here through the alias.
  events: require('events/events.js'),
  fs: require('./fs.cjs'),
  'fs/promises': require('./fs-promises.cjs'),
  module: require('./module.cjs'),
  net: require('./net.cjs'),
  os: require('./os.cjs'),
  path: require('./path.cjs'),
  'path/posix': require('./path.cjs'),
  perf_hooks: { performance: globalThis.performance },
  process: require('./process.cjs'),
  querystring: trap('node:querystring'),
  readline: trap('node:readline'),
  stream: trap('node:stream'),
  string_decoder: trap('node:string_decoder'),
  tty: require('./tty.cjs'),
  url: require('./url.cjs'),
  util: require('./util.cjs'),
  'util/types': require('./util-types.cjs'),
  v8: trap('node:v8'),
  vm: trap('node:vm'),
  worker_threads: trap('node:worker_threads'),
  zlib: trap('node:zlib'),
};

module.exports = builtins;
