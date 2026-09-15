// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ApiData } from './generate-api-data.ts';
import { sourceStrings } from './i18n-strings.ts';
import type { Translations } from './render.ts';

const DATA = join(dirname(fileURLToPath(import.meta.url)), '../api-data');
const locale = process.argv[2] ?? 'zh';
const check = process.argv.includes('--check');
const pending: string[] = [];
const OUT = join(DATA, locale);
mkdirSync(OUT, { recursive: true });

let total = 0, todo = 0, stale = 0;
for (
  const file of readdirSync(DATA).filter(f =>
    f.endsWith('.json') && f !== 'index.json' && f !== 'rsbuild-config.json'
  )
) {
  const api = JSON.parse(readFileSync(join(DATA, file), 'utf8')) as ApiData;
  const path = join(OUT, file);
  const existing = existsSync(path)
    ? JSON.parse(readFileSync(path, 'utf8')) as Translations
    : {};
  const next: Translations = {};
  for (const [key, en] of sourceStrings(api)) {
    const prev = existing[key];
    total++;
    if (prev?.text) {
      if (prev.en !== en) {
        stale++;
        pending.push(`${file} ${key} (stale)`);
      }
      next[key] = { en: prev.en, text: prev.text };
    } else {
      todo++;
      pending.push(`${file} ${key} (untranslated)`);
      next[key] = { en, text: '' };
    }
  }
  for (const key of Object.keys(existing)) {
    if (!(key in next)) pending.push(`${file} ${key} (removed from source)`);
  }
  if (!check && Object.keys(next).length > 0) {
    writeFileSync(path, JSON.stringify(next, null, 2) + '\n');
  }
}
console.info(
  `${locale}: ${total} strings, ${todo} untranslated, ${stale} stale`,
);
if (check && pending.length > 0) {
  console.error(
    `${
      pending.join('\n')
    }\n\nRun \`pnpm --filter docs i18n:extract\`, translate the strings in docs/api-data/${locale}/*.json and commit them.`,
  );
  process.exitCode = 1;
}
