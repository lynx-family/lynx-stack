// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@rstest/core';

const genuiRoot = fileURLToPath(new URL('../../', import.meta.url));

test.each(['a2ui', 'openui'])(
  '%s declarations resolve React types through ReactLynx',
  async (renderer) => {
    const directory = path.join(genuiRoot, renderer, 'dist');
    const files = await readdir(directory, { recursive: true });
    const declarations = files.filter(file => file.endsWith('.d.ts'));
    expect(declarations.length).toBeGreaterThan(0);
    for (const file of declarations) {
      const declaration = await readFile(path.join(directory, file), 'utf8');
      expect(declaration, `${renderer}/${file}`).not.toMatch(
        /\b(?:from\s*|import\s*(?:\(\s*)?)["']react(?:\/[^"']*)?["']/u,
      );
    }
  },
);
