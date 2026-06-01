// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe } from 'vitest';

import { runRenderFixtureTests } from '../../test-utils/debug/renderFixtureRunner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURES_DIR = path.resolve(__dirname, '../../fixtures/render');

describe('Render fixtures', () => {
  runRenderFixtureTests(FIXTURES_DIR);
});
