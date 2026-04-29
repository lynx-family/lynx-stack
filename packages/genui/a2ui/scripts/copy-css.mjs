// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDir, '..');
const srcRoot = path.join(packageRoot, 'src');
const distRoot = path.join(packageRoot, 'dist');

copyCssFiles(srcRoot);

function copyCssFiles(currentDir) {
  for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
    const sourcePath = path.join(currentDir, entry.name);

    if (entry.isDirectory()) {
      copyCssFiles(sourcePath);
      continue;
    }

    if (!entry.isFile() || path.extname(entry.name) !== '.css') {
      continue;
    }

    const relativePath = path.relative(srcRoot, sourcePath);
    const outputPath = path.join(distRoot, relativePath);

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.copyFileSync(sourcePath, outputPath);
  }
}
