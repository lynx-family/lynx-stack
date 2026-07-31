#!/usr/bin/env node

// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
const { readFileSync } = require('node:fs');

const lockfile = readFileSync('pnpm-lock.yaml', 'utf8');
const found = lockfile.match(/^ {2}'?preact@[^:]*:/gm) ?? [];

if (found.length > 0) {
  console.error(
    `A standalone \`preact\` package appeared in pnpm-lock.yaml:\n\n${
      found.map((line) => `  ${line.trim()}`).join('\n')
    }\n\nEvery \`preact\` specifier must resolve to the vendored`
      + ' `@lynx-js/internal-preact` (the `lynxjs` catalog in'
      + ' pnpm-workspace.yaml), or two preact module instances exist at'
      + ' runtime. Alias `preact: "catalog:lynxjs"` in the package that'
      + ' pulled it in.',
  );
  throw new Error(
    `${found.length} standalone preact instance(s) in pnpm-lock.yaml.`,
  );
}

console.info('All preact specifiers resolve to @lynx-js/internal-preact.');
