// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { withCodSpeed } from '@codspeed/tinybench-plugin';
import { Bench } from 'tinybench';

import { executeTemplate } from '@lynx-js/web-core/server';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadTemplate(name) {
  return fs.readFileSync(path.resolve(__dirname, `../dist/${name}.web.bundle`));
}

const cases = [
  'basic-performance-div-10000',
  'basic-performance-div-1000',
  'basic-performance-div-100',
  'basic-performance-nest-level-100',
  'basic-performance-image-100',
  'basic-performance-scroll-view-100',
  'basic-performance-text-200',
  'basic-performance-large-css',
  'basic-performance-small-css',
];

const bench = withCodSpeed(new Bench({ name: 'server-bench' }));

for (const name of cases) {
  const rawTemplate = loadTemplate(name);
  bench.add(name, async () => {
    await executeTemplate(
      rawTemplate,
      {}, // initData
      {}, // globalProps
      {}, // initI18nResources
    );
  });
}

await bench.run();
console.table(bench.table());
