// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import { getPackages } from '@manypkg/get-packages';

const [outputPath, storage] = process.argv.slice(2);
if (!outputPath || !storage) {
  throw new Error('Usage: pnpr-config.js <output-path> <storage-path>');
}

const { packages } = await getPackages(process.cwd());
const packageRules = Object.fromEntries(
  packages
    .filter(pkg => pkg.packageJson.private !== true)
    .map(pkg => `${pkg.packageJson.name}-canary`)
    .sort()
    .map(name => [name, { access: '$all', publish: '$all' }]),
);

const config = {
  storage,
  auth: {
    htpasswd: {
      file: path.join(storage, 'auth', 'htpasswd'),
      max_users: 1,
    },
    tokens: {
      file: path.join(storage, 'auth', 'tokens.db'),
    },
  },
  resolver: {
    enabled: true,
  },
  registries: {
    local: {
      type: 'hosted',
      access: '$all',
      packages: packageRules,
    },
    npmjs: {
      type: 'upstream',
      url: 'https://registry.npmjs.org/',
      public: true,
    },
    main: {
      type: 'router',
      sources: ['local', 'npmjs'],
    },
  },
  defaultRegistry: 'main',
  log: {
    type: 'stdout',
    format: 'pretty',
    level: 'error',
  },
};

await writeFile(outputPath, JSON.stringify(config, null, 2) + '\n');
