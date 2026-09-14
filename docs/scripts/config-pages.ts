// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';

import { EN, ZH, configPagePaths, configPageUrl } from './render.ts';

const OVERVIEW_LABEL = { en: 'Overview', zh: '概览' } as const;
const MARKER = '{/* @api ConfigOption ';

const skeleton = (path: string, lynx: boolean) =>
  `---
title: ${path}${lynx ? '' : '\noutline: false'}
---

# ${path}

${MARKER}package="rspeedy" path="${path}" */}
{/* @api-end */}
`;

const writeJson = (file: string, value: unknown) =>
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);

function removeStale(dir: string, prefix: string, wanted: Set<string>): void {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) {
      removeStale(p, `${prefix}${entry}/`, wanted);
      if (readdirSync(p).every(f => f === '_meta.json')) {
        rmSync(p, { recursive: true });
      }
      continue;
    }
    const rel = `${prefix}${entry.replace(/\.mdx?$/, '')}`;
    if (
      /\.mdx?$/.test(entry) && !wanted.has(rel)
      && readFileSync(p, 'utf8').includes(MARKER)
    ) {
      rmSync(p);
    }
  }
}

export function syncConfigPages(docsRoot: string): void {
  const pages = configPagePaths(join(docsRoot, 'api-data')).map((
    { path, lynx },
  ) => ({
    path,
    lynx,
    rel: configPageUrl(path).slice('/config/'.length),
  }));
  const wanted = new Set(pages.map(p => p.rel));
  for (const locale of ['en', 'zh'] as const) {
    const root = join(docsRoot, 'content', locale, 'config');
    removeStale(root, '', wanted);
    const meta: unknown[] = [
      { type: 'file', name: 'index', label: OVERVIEW_LABEL[locale] },
    ];
    const sections = new Map<string, unknown[]>();
    const l = locale === 'zh' ? ZH : EN;
    for (const { path, lynx, rel } of pages) {
      const file = join(root, `${rel}.mdx`);
      if (!existsSync(file)) {
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, skeleton(path, lynx));
      }
      const tag = lynx ? l.lynxBadge : l.defaultBadge;
      const [ns, name] = rel.split('/');
      if (!name) {
        meta.push({ type: 'file', name: ns, label: path, tag });
        continue;
      }
      if (!sections.has(ns!)) {
        sections.set(ns!, []);
        meta.push({ type: 'dir-section-header', name: ns, label: ns });
      }
      sections.get(ns!)!.push({ type: 'file', name, label: path, tag });
    }
    writeJson(join(root, '_meta.json'), meta);
    for (const [ns, items] of sections) {
      writeJson(join(root, ns, '_meta.json'), items);
    }
  }
}
