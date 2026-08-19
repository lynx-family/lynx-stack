// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { writeFile } from 'node:fs/promises';
import os from 'node:os';
import { pathToFileURL } from 'node:url';

import { getPackages } from '@manypkg/get-packages';

/**
 * Build a pnpr config that publishes every public workspace package locally.
 *
 * pnpr does not fall through to the next registry after a package matches a
 * hosted-registry rule. Exact package rules keep unpublished dependencies on
 * npmjs while ensuring every canary package resolves to the local build.
 *
 * @param {Array<{ packageJson: { name: string, private?: boolean } }>} packages
 * @param {string} storage
 * @returns {Record<string, unknown>}
 */
export function createPnprConfig(packages, storage) {
  const packageRules = Object.fromEntries(
    packages
      .filter(pkg => pkg.packageJson.private !== true)
      .map(pkg => `${pkg.packageJson.name}-canary`)
      .sort()
      .map(name => [name, { access: '$all', publish: '$all' }]),
  );

  return {
    storage,
    resolver: {
      enabled: false,
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
}

/**
 * @param {string} outputPath
 * @param {string} storage
 * @returns {Promise<void>}
 */
export async function writePnprConfig(outputPath, storage) {
  const { packages } = await getPackages(process.cwd());
  const config = createPnprConfig(packages, storage);

  await writeFile(
    outputPath,
    JSON.stringify(config, null, 2) + os.EOL,
  );
}

const entryPath = process.argv[1];
if (entryPath && import.meta.url === pathToFileURL(entryPath).href) {
  const [outputPath, storage] = process.argv.slice(2);
  if (!outputPath || !storage) {
    throw new Error('Usage: pnpr-config.js <output-path> <storage-path>');
  }

  await writePnprConfig(outputPath, storage);
}
