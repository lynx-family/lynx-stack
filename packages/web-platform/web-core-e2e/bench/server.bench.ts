// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { Bench, withCodSpeed } from '@lynx-js/codspeed-tinybench';
import { executeTemplate } from '@lynx-js/web-core/server';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function loadTemplate(name: string) {
  const bundlePath = path.resolve(__dirname, `../dist/${name}.web.bundle`);
  return fs.readFileSync(bundlePath);
}

const cases = {
  'basic-performance-div-10000': await loadTemplate(
    'basic-performance-div-10000',
  ),
  'basic-performance-div-1000': await loadTemplate(
    'basic-performance-div-1000',
  ),
  'basic-performance-div-100': await loadTemplate('basic-performance-div-100'),
  'basic-performance-nest-level-100': await loadTemplate(
    'basic-performance-nest-level-100',
  ),
  'basic-performance-image-100': await loadTemplate(
    'basic-performance-image-100',
  ),
  'basic-performance-scroll-view-100': await loadTemplate(
    'basic-performance-scroll-view-100',
  ),
  'basic-performance-text-200': await loadTemplate(
    'basic-performance-text-200',
  ),
  'basic-performance-large-css': await loadTemplate(
    'basic-performance-large-css',
  ),
  'basic-performance-small-css': await loadTemplate(
    'basic-performance-small-css',
  ),
};

const bench = new Bench();

for (const [testName, rawTemplate] of Object.entries(cases)) {
  bench.add(`server-bench > ${testName}`, async () => {
    await executeTemplate(
      rawTemplate,
      {}, // initData
      {}, // globalProps
      {}, // initI18nResources
    );
  });
}

await withCodSpeed(bench, import.meta.url);
