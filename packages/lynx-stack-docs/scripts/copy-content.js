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
const SOURCE = join(PACKAGE, '../../docs/content');
const TARGET = join(PACKAGE, 'content');
const SECTIONS = ['config', 'react/api', 'packages'];

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
  for (const section of SECTIONS) {
    const from = join(SOURCE, locale, section);
    if (!existsSync(from)) throw new Error(`${from} does not exist`);
    copyDir(from, join(TARGET, locale, section));
  }
}
