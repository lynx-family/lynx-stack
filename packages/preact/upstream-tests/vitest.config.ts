// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { defineConfig } from 'vitest/config';

import { createBaseConfig } from './vitest.shared.js';

// Direct rendering mode: Preact renders natively in jsdom, no pipeline.
// This is the simplest possible configuration — no plugins beyond the skiplist,
// no BSI shims, no snapshot machinery, no dual-thread setup.
export default defineConfig(createBaseConfig());
