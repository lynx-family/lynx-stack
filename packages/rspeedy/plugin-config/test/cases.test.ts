// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describeCases } from '@lynx-js/test-tools'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

describeCases({
  name: 'config',
  casePath: path.join(__dirname, 'cases'),
})
