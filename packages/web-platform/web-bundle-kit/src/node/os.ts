// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// One CPU, no network: nothing in a build may start worker pools or bind
// sockets in the kit.
const os = {
  EOL: '\n',
  availableParallelism: () => 1,
  cpus: () => [{ model: 'browser', speed: 0, times: {} }],
  platform: () => 'linux',
  type: () => 'Linux',
  arch: () => 'wasm32',
  release: () => '',
  homedir: () => '/',
  tmpdir: () => '/tmp',
  hostname: () => 'localhost',
  networkInterfaces: () => ({}),
  totalmem: () => 0,
  freemem: () => 0,
  endianness: () => 'LE',
  userInfo: () => ({
    username: 'web',
    uid: -1,
    gid: -1,
    shell: null,
    homedir: '/',
  }),
  constants: { signals: {}, errno: {}, priority: {} },
} satisfies Partial<Record<keyof typeof import('node:os'), unknown>>;

export const {
  EOL,
  availableParallelism,
  cpus,
  platform,
  type,
  arch,
  release,
  homedir,
  tmpdir,
  hostname,
  networkInterfaces,
  totalmem,
  freemem,
  endianness,
  userInfo,
  constants,
} = os;
export default os;
