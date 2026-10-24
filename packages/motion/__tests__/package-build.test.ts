// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { readFileSync, readdirSync } from 'node:fs';
import { URL as NodeURL } from 'node:url';
import { test, expect } from 'vitest';

test('published JavaScript and public declarations do not import build dependencies', () => {
  const manifest = JSON.parse(
    readFileSync(new NodeURL('../package.json', import.meta.url), 'utf8'),
  );
  for (
    const dependency of ['@babel/core', 'motion', 'motion-dom', 'motion-utils']
  ) {
    expect(manifest.devDependencies[dependency]).toBeDefined();
    expect(manifest.dependencies?.[dependency]).toBeUndefined();
  }

  const dist = new NodeURL('../dist/', import.meta.url);
  const files = [
    ...readdirSync(dist, { recursive: true }).filter(file =>
      file.endsWith('.js')
    ),
    'index.d.ts',
    'mini/index.d.ts',
  ];
  for (const file of files) {
    const code = readFileSync(
      new NodeURL(file.replaceAll('\\', '/'), dist),
      'utf8',
    );
    expect(code, file).not.toMatch(
      /(?:^|\n)(?:import|export)\b[^;]*?\bfrom\s*['"](?:motion(?:-dom|-utils)?|framer-motion|@babel\/[^'"]+)['"]/,
    );
    expect(code, file).not.toMatch(
      /\bimport\(\s*['"](?:motion(?:-dom|-utils)?|framer-motion|@babel\/[^'"]+)['"]/,
    );
  }
});
