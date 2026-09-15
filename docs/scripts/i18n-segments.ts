// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { hashText } from './render.ts';
import type { Translations } from './render.ts';

const ZH = join(dirname(fileURLToPath(import.meta.url)), '../api-data/zh');
const FENCE = /(```[^\n]*\n[\s\S]*?\n```)/;
const NEWLINE = ' ⏎ ';

function load(pkg: string): Translations {
  return JSON.parse(
    readFileSync(join(ZH, `${pkg}.json`), 'utf8'),
  ) as Translations;
}

function save(pkg: string, translations: Translations): void {
  writeFileSync(
    join(ZH, `${pkg}.json`),
    `${JSON.stringify(translations, null, 2)}\n`,
  );
}

function dump(dir: string, pkgs: string[]): void {
  mkdirSync(dir, { recursive: true });
  for (const pkg of pkgs) {
    const lines: string[] = [];
    for (const [key, t] of Object.entries(load(pkg))) {
      if (t.en === undefined) continue;
      t.en.split(FENCE).forEach((segment, i) => {
        if (i % 2 === 0 && segment.trim()) {
          lines.push(
            `${key}\t${i}\t${segment.trim().replaceAll('\n', NEWLINE)}`,
          );
        }
      });
    }
    writeFileSync(join(dir, `seg-${pkg}.tsv`), lines.join('\n'));
    console.info(`${pkg}: ${lines.length} segments`);
  }
}

function apply(dir: string): void {
  const byPackage = new Map<string, Map<string, Map<number, string>>>();
  const files = readdirSync(dir).filter(f => /^seg-.+\.zh\.tsv$/.test(f));
  for (const file of files.sort()) {
    const pkg = file.slice('seg-'.length, -'.zh.tsv'.length).replace(
      /\.part\d+$/,
      '',
    );
    const segments = byPackage.get(pkg)
      ?? new Map<string, Map<number, string>>();
    byPackage.set(pkg, segments);
    const text = readFileSync(join(dir, file), 'utf8').replaceAll('\r', '');
    for (const line of text.split('\n')) {
      if (!line.trim() || line.startsWith('#')) continue;
      const a = line.indexOf('\t');
      const b = line.indexOf('\t', a + 1);
      const key = line.slice(0, a);
      const byIndex = segments.get(key) ?? new Map<number, string>();
      segments.set(key, byIndex);
      byIndex.set(
        Number(line.slice(a + 1, b)),
        line.slice(b + 1).replaceAll(NEWLINE, '\n'),
      );
    }
  }
  for (const [pkg, segments] of byPackage) {
    const translations = load(pkg);
    let applied = 0;
    for (const [key, byIndex] of segments) {
      const t = translations[key];
      if (t?.en === undefined) continue;
      const parts = t.en.split(FENCE);
      for (const [i, text] of byIndex) {
        if (i >= parts.length) continue;
        parts[i] = (i > 0 ? '\n\n' : '') + text
          + (i < parts.length - 1 ? '\n\n' : '');
      }
      translations[key] = {
        hash: hashText(t.en),
        text: parts.join('').trim(),
      };
      applied++;
    }
    save(pkg, translations);
    console.info(`${pkg}: ${applied} applied`);
  }
}

const [command, dir, ...pkgs] = process.argv.slice(2);
if (command === 'dump' && dir) {
  dump(dir, pkgs);
} else if (command === 'apply' && dir) {
  apply(dir);
} else {
  console.error(
    'Usage: node scripts/i18n-segments.ts dump <dir> <package>... | apply <dir>',
  );
  process.exitCode = 1;
}
