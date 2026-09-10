// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { readFile, writeFile } from 'node:fs/promises';

import { zipSync } from 'fflate';

// Bench sanitization disables remote images and lazy bundles. These native
// renderer templates are self-contained; each archive uses the same entry.
for (const protocol of ['a2ui', 'openui']) {
  const bundle = await readFile(
    new URL(`../www/${protocol}.lynx.js`, import.meta.url),
  );
  const archive = zipSync({ 'template.js': bundle }, {
    level: 6,
    mtime: new Date(1980, 0, 1),
  });
  if (
    archive.byteLength > 10 * 1024 * 1024
    || bundle.byteLength > 50 * 1024 * 1024
  ) {
    throw new Error(`${protocol} Bench archive exceeds UI Judge size limits.`);
  }
  await writeFile(
    new URL(`../www/${protocol}.lynx.zip`, import.meta.url),
    archive,
  );
}
