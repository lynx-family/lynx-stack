// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import fs from 'node:fs';
import path from 'node:path';

const catalogDir = path.resolve('dist/catalog');
const indexPath = path.join(catalogDir, 'index.js');
const marker = 'export const catalogManifests = {};';

const manifests = {};
for (const entry of fs.readdirSync(catalogDir, { withFileTypes: true })) {
  if (!entry.isDirectory() || entry.name === 'functions') continue;

  const manifestPath = path.join(catalogDir, entry.name, 'catalog.json');
  if (!fs.existsSync(manifestPath)) continue;

  manifests[entry.name] = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

const source = fs.readFileSync(indexPath, 'utf8');
const replacement = `export const catalogManifests = ${
  JSON.stringify(manifests, null, 2)
};\n`;
const generatedManifestRe =
  /export const catalogManifests = [\s\S]*?;\n+(?=\/\/ Per-component re-exports|export \{ Button \})/;
const hasGeneratedManifest = generatedManifestRe.test(source);

if (!source.includes(marker) && !hasGeneratedManifest) {
  throw new Error(
    `[a2ui] Could not find catalog manifest marker in ${indexPath}.`,
  );
}

const nextSource = source.includes(marker)
  ? source.replace(marker, replacement)
  : source.replace(generatedManifestRe, replacement);

fs.writeFileSync(indexPath, nextSource);
