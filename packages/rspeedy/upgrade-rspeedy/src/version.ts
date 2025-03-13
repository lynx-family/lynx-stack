// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { createRequire } from 'node:module'

import type { PackageJson } from 'type-fest'

const require = createRequire(import.meta.url)

// Using `import('../package.json', { with: { type: 'json' } })` will cause NodeJS print a
// experimental warning.
// eslint-disable-next-line import/no-commonjs
const pkg = require(
  '../package.json',
) as PackageJson

const version: PackageJson['version'] = pkg.version
const devDependencies: PackageJson['devDependencies'] = pkg.devDependencies

export { version, devDependencies }
