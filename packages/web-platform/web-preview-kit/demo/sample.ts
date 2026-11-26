// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/** The sample project of the demo: the two-card fixture of the tests. */

import type { FileMap, ProjectConfig } from '../src/protocol.js';
import detailCss from '../fixtures/two-cards/src/detail.css?raw';
import detailTsx from '../fixtures/two-cards/src/detail.tsx?raw';
import greetingTs from '../fixtures/two-cards/src/greeting.ts?raw';
import mainComponentTsx from '../fixtures/two-cards/src/MainCard.tsx?raw';
import mainCss from '../fixtures/two-cards/src/main.css?raw';
import mainTsx from '../fixtures/two-cards/src/main.tsx?raw';

export const sampleFiles: FileMap = {
  'src/main.tsx': mainTsx,
  'src/MainCard.tsx': mainComponentTsx,
  'src/main.css': mainCss,
  'src/greeting.ts': greetingTs,
  'src/detail.tsx': detailTsx,
  'src/detail.css': detailCss,
};

export const sampleConfig: ProjectConfig = {
  entries: { main: 'src/main.tsx', detail: 'src/detail.tsx' },
};
