// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  findCatalogSourceFiles,
  writeComponentCatalogs,
} from '../../a2ui-catalog-extractor/src/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_DIR = path.resolve(__dirname, '..');
const CATALOG_DIR = path.join(BASE_DIR, 'src/catalog');
const DIST_CATALOG_DIR = path.join(BASE_DIR, 'dist/catalog');

const sourceFiles = findCatalogSourceFiles(CATALOG_DIR).filter(file =>
  path.basename(file) === 'index.tsx'
);
console.log(`Found ${sourceFiles.length} component files`);

const components = await writeComponentCatalogs({
  cwd: BASE_DIR,
  outDir: DIST_CATALOG_DIR,
  sourceFiles,
});

for (const component of components) {
  console.log(`Generated strict schema for ${component.name}`);
}
