// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Resolve @lynx-js/types from node_modules (works with pnpm hoisting)
function findPackageDir(packageName) {
  const candidates = [
    join(__dirname, '../node_modules', packageName),
    join(__dirname, '../../../node_modules', packageName),
  ];
  for (const dir of candidates) {
    try {
      statSync(dir);
      return dir;
    } catch { /* skip */ }
  }
  // Fallback: resolve via pnpm store
  const pnpmDir = join(
    __dirname,
    '../../../node_modules/.pnpm',
  );
  try {
    for (const entry of readdirSync(pnpmDir)) {
      if (
        entry.startsWith(packageName.replace('/', '+').replace('@', '') + '@')
        || entry.startsWith(packageName.replace('/', '+') + '@')
      ) {
        const resolved = join(pnpmDir, entry, 'node_modules', packageName);
        try {
          statSync(resolved);
          return resolved;
        } catch { /* skip */ }
      }
    }
  } catch { /* skip */ }
  throw new Error(`Cannot find ${packageName} in node_modules`);
}

function collectDtsFiles(dir, baseDir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      results.push(...collectDtsFiles(fullPath, baseDir));
    } else if (entry.endsWith('.d.ts')) {
      results.push({
        relativePath: relative(baseDir, fullPath),
        content: readFileSync(fullPath, 'utf-8'),
      });
    }
  }
  return results;
}

// Collect @lynx-js/types
const lynxTypesDir = findPackageDir('@lynx-js/types');
const lynxTypesRoot = join(lynxTypesDir, 'types');
const lynxFiles = collectDtsFiles(lynxTypesRoot, lynxTypesRoot);

// Collect csstype (external dependency used by @lynx-js/types)
const csstypeDir = findPackageDir('csstype');
const csstypeIndex = join(csstypeDir, 'index.d.ts');
let csstypeContent;
try {
  csstypeContent = readFileSync(csstypeIndex, 'utf-8');
} catch {
  console.warn('Warning: csstype/index.d.ts not found, using stub');
  csstypeContent =
    'export interface Properties<TLength = string | 0, TTime = string> { [key: string]: any; }';
}

// Build the output map
const typeMap = {};

// Add csstype with proper virtual path so @lynx-js/types can import it
typeMap['node_modules/csstype/index.d.ts'] = csstypeContent;

// Add all @lynx-js/types files
for (const file of lynxFiles) {
  typeMap[`node_modules/@lynx-js/types/types/${file.relativePath}`] =
    file.content;
}

// Write JSON output
const outputDir = join(__dirname, '../src/generated');
mkdirSync(outputDir, { recursive: true });
writeFileSync(
  join(outputDir, 'lynx-types-map.json'),
  JSON.stringify(typeMap, null, 2),
);

console.info(
  `Collected ${
    Object.keys(typeMap).length
  } type files → src/generated/lynx-types-map.json`,
);
