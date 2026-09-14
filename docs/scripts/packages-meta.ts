// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { PACKAGES, PACKAGE_GROUPS } from './packages.ts';
import { EN, ZH, packageLabel } from './render.ts';

export function syncPackagesMeta(docsRoot: string): void {
  const dataDir = join(docsRoot, 'api-data');
  for (const locale of ['en', 'zh'] as const) {
    const l = locale === 'zh' ? ZH : EN;
    const prefix = locale === 'zh' ? '/zh' : '';
    const meta: unknown[] = [{
      type: 'file',
      name: 'index',
      label: l.overview,
    }];
    for (const group of PACKAGE_GROUPS) {
      meta.push({ type: 'section-header', label: l.packageGroups[group] });
      for (const entry of PACKAGES.filter(e => e.group === group)) {
        const label = packageLabel(dataDir, entry);
        meta.push(
          entry.page
            ? { type: 'custom-link', label, link: `${prefix}${entry.page}` }
            : { type: 'file', name: entry.id, label },
        );
      }
    }
    writeFileSync(
      join(docsRoot, 'content', locale, 'packages', '_meta.json'),
      `${JSON.stringify(meta, null, 2)}\n`,
    );
  }
}
