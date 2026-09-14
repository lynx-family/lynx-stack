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

import type { ApiData, ApiExport, ApiMember } from './generate-api-data.ts';
import { hashText } from './render.ts';
import type { Translations } from './render.ts';

const DATA = join(dirname(fileURLToPath(import.meta.url)), '../api-data');
const locale = process.argv[2] ?? 'zh';
const OUT = join(DATA, locale);
mkdirSync(OUT, { recursive: true });

interface Entry {
  key: string;
  en: string;
}

function collectMember(owner: string, m: ApiMember, out: Entry[]): void {
  const key = `${owner}.${m.name}`;
  if (m.summary) out.push({ key: `${key}.summary`, en: m.summary });
  if (m.remarks) out.push({ key: `${key}.remarks`, en: m.remarks });
  if (m.default !== undefined) {
    out.push({ key: `${key}.default`, en: m.default });
  }
  if (m.deprecated !== undefined) {
    out.push({ key: `${key}.deprecated`, en: m.deprecated });
  }
  m.examples?.forEach((e, i) =>
    out.push({ key: `${key}.example.${i}`, en: e })
  );
  m.params?.forEach(p => {
    if (p.description) {
      out.push({ key: `${key}.params.${p.name}`, en: p.description });
    }
  });
}

function collectExport(e: ApiExport, out: Entry[]): void {
  collectMember('', { ...e, name: e.name }, out);
  const sig = e.signatures?.[0];
  if (sig?.returns.description) {
    out.push({ key: `${e.name}.returns`, en: sig.returns.description });
  }
  for (const m of e.members ?? []) collectMember(e.name, m, out);
}

let total = 0, todo = 0, stale = 0;
for (
  const file of readdirSync(DATA).filter(f =>
    f.endsWith('.json') && f !== 'index.json' && f !== 'rsbuild-config.json'
  )
) {
  const api = JSON.parse(readFileSync(join(DATA, file), 'utf8')) as ApiData;
  const entries: Entry[] = [];
  for (const e of api.exports) collectExport(e, entries);
  const fixed = entries.map(x => ({ key: x.key.replace(/^\./, ''), en: x.en }));
  const path = join(OUT, file);
  const existing = existsSync(path)
    ? JSON.parse(readFileSync(path, 'utf8')) as Translations
    : {};
  const next: Record<string, { hash: string; text: string; en?: string }> = {};
  for (const { key, en } of fixed) {
    const hash = hashText(en);
    const prev = existing[key];
    total++;
    if (prev && prev.hash === hash && prev.text) {
      next[key] = { hash, text: prev.text };
    } else {
      if (prev?.text) stale++;
      else todo++;
      next[key] = { hash, text: prev?.text ?? '', en };
    }
  }
  if (Object.keys(next).length > 0) {
    writeFileSync(path, JSON.stringify(next, null, 2) + '\n');
  }
}
console.info(
  `${locale}: ${total} strings, ${todo} untranslated, ${stale} stale`,
);
