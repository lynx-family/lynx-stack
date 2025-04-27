// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { rspack } from '@rsbuild/core'

import pkg from '../package.json' with { type: 'json' }

const version: string = pkg.version

export const rspackVersion: string = rspack.rspackVersion

export { version }

export { version as rsbuildVersion } from '@rsbuild/core'
