// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PACKAGES } from './packages.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

export function syncChangelogs(contentRoot: string): void {
  const entries = PACKAGES
    .filter(entry => existsSync(join(ROOT, entry.dir, 'CHANGELOG.md')))
    .map(entry => {
      const { name } = JSON.parse(
        readFileSync(join(ROOT, entry.dir, 'package.json'), 'utf8'),
      ) as { name: string };
      return {
        name,
        file: name.replace(/^@/, '').replace(/\//g, '--'),
        source: join(ROOT, entry.dir, 'CHANGELOG.md'),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const locale of ['en', 'zh']) {
    const dir = join(contentRoot, locale, 'changelog');
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    for (const { file, source } of entries) {
      copyFileSync(source, join(dir, `${file}.md`));
    }
    writeFileSync(
      join(dir, '_meta.json'),
      JSON.stringify(
        entries.map(({ name, file }) => ({
          type: 'file',
          name: file,
          label: name,
        })),
        null,
        2,
      ) + '\n',
    );
  }
}
