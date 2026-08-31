#!/usr/bin/env node
// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { probeInstalledAgents } from '../dist/playground/adapters.js';

console.info(JSON.stringify(
  {
    note:
      'Read-only Agent installation and authentication probe. No login or generation is attempted.',
    agents: probeInstalledAgents(process.cwd()),
  },
  null,
  2,
));
