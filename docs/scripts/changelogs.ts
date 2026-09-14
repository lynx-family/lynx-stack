// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PACKAGES } from './packages.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

function writeIfChanged(file: string, content: string): void {
  if (existsSync(file) && readFileSync(file, 'utf8') === content) return;
  writeFileSync(file, content);
}

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
  const wanted = new Set([
    '_meta.json',
    ...entries.map(({ file }) => `${file}.md`),
  ]);

  for (const locale of ['en', 'zh']) {
    const dir = join(contentRoot, locale, 'changelog');
    mkdirSync(dir, { recursive: true });
    for (const name of readdirSync(dir)) {
      if (!wanted.has(name)) rmSync(join(dir, name), { recursive: true });
    }
    for (const { file, source } of entries) {
      writeIfChanged(join(dir, `${file}.md`), readFileSync(source, 'utf8'));
    }
    writeIfChanged(
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
