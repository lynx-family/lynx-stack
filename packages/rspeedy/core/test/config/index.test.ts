// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core'

import * as dev from '../../src/config/dev/index.js'
import * as config from '../../src/config/index.js'
import * as filename from '../../src/config/output/filename.js'
import * as output from '../../src/config/output/index.js'
import * as minify from '../../src/config/output/minify.js'
import * as entry from '../../src/config/source/entry.js'
import * as source from '../../src/config/source/index.js'

describe('Config Declaration', () => {
  test('should not export any JS', () => {
    const modules = [
      // Entry point
      config,

      // Output
      filename,
      minify,

      // Top level
      dev,
      entry,
      output,
      source,
    ]
    modules.forEach(module => {
      expect(
        Object.getOwnPropertyNames(module)
          // rstest's bundler tags every ES module with `__esModule`.
          .filter(name => name !== '__esModule'),
      ).toHaveLength(0)
    })
  })
})
