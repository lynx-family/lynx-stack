// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE = join(dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = join(PACKAGE, '../../docs');
const SOURCE = join(DOCS, 'content');
const TARGET = join(PACKAGE, 'content');

function copyDir(from, to) {
  mkdirSync(to, { recursive: true });
  for (const name of readdirSync(from)) {
    const source = join(from, name);
    const target = join(to, name);
    if (statSync(source).isDirectory()) copyDir(source, target);
    else copyFileSync(source, target);
  }
}

rmSync(TARGET, { recursive: true, force: true });
for (const locale of ['en', 'zh']) {
  const from = join(SOURCE, locale, 'api');
  if (!existsSync(from)) throw new Error(`${from} does not exist`);
  copyDir(from, join(TARGET, locale, 'api'));
}
copyFileSync(
  join(DOCS, 'shown-packages.json'),
  join(PACKAGE, 'shown-packages.json'),
);
