// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import { LOCALES } from './workspace.ts';

/** Fails generation if language switching would target a missing API page. */
export function assertLocaleRoutes(content: string): void {
  const pages = (locale: string) =>
    new Set(
      readdirSync(join(content, locale, 'api'), {
        recursive: true,
        withFileTypes: true,
      }).filter(entry => entry.isFile() && /\.mdx?$/.test(entry.name))
        .map(entry =>
          join(entry.parentPath, entry.name)
            .slice(join(content, locale).length + 1)
        ),
    );
  const english = pages('en');
  for (const locale of LOCALES.filter(locale => locale !== 'en')) {
    const localized = pages(locale);
    const missing = [...english].filter(page => !localized.has(page));
    const extra = [...localized].filter(page => !english.has(page));
    if (missing.length > 0 || extra.length > 0) {
      throw new Error(
        `API routes differ between en and ${locale}:\n${
          missing.map(page => `  Missing in ${locale}: ${page}`).join('\n')
        }\n${extra.map(page => `  Missing in en: ${page}`).join('\n')}`,
      );
    }
  }
}
