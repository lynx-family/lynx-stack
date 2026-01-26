/// <reference types="vitest/globals" />

import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Import using relative path from same directory
// This dynamic import triggers chunk creation for ./Foo.jsx
import('./Foo.jsx');

// Import using subdirectory importer (which uses ../Foo.jsx)
// This creates another import path to the same file
import { loadFooFromSubdir } from './subdir/importer.jsx';

it('should generate only ONE async bundle for Foo', async () => {
  // Ensure loadFooFromSubdir is used to prevent tree-shaking
  expect(loadFooFromSubdir).toBeDefined();

  // The async bundles are generated in the 'async' folder relative to __dirname
  const asyncDir = resolve(__dirname, 'async');
  const asyncTemplates = await readdir(asyncDir);

  // Filter to only .bundle files (exclude other artifacts)
  const bundles = asyncTemplates.filter(f => f.endsWith('.bundle'));

  // Key assertion: ./Foo.jsx and ../Foo.jsx should produce SINGLE bundle
  // because they resolve to the same file
  expect(bundles).toHaveLength(1);
});

it('should have correct imports in the compiled code', async () => {
  // Verify that webpack code references both imports
  const mainFile = await readFile(__filename, 'utf-8');

  // The import statements should exist in the compiled code
  expect(mainFile).toContain('./Foo.jsx');
  expect(mainFile).toContain('./subdir/importer.jsx');
});
