// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readdirSync } from 'node:fs';
import { test as base } from '@playwright/test';
import type { Page } from '@playwright/test';
import v8ToIstanbul from 'v8-to-istanbul';

const __dirname = fileURLToPath(import.meta.url);
const webCoreDist = path.join(
  __dirname,
  '..',
  '..',
  '..',
  'web-core',
  'dist',
  'client_prod',
);
// recursive find all *.map files
const getWebCoreMappedFiles = () => {
  try {
    const files = readdirSync(webCoreDist, { recursive: true });
    return files
      .filter((f) => typeof f === 'string' && f.endsWith('.map'))
      .map((f) => path.join(webCoreDist, (f as string).replace(/\.map$/, '')));
  } catch (e) {
    return [];
  }
};

export const test: typeof base = base.extend({
  context: async ({ browserName, context }, use, testInfo) => {
    const dir = path.join(__dirname, '..', '..', '..', '.nyc_output');
    await fs.mkdir(dir, { recursive: true });
    if (browserName !== 'chromium') {
      // Coverage is not supported on non-chromium browsers
      return use(context);
    }

    const pages = new Set<Page>();

    context.on('page', async (page) => {
      if (testInfo.titlePath.join(' ').includes('SSR No JS')) {
        return;
      }
      await page.coverage.startJSCoverage({
        reportAnonymousScripts: true,
        resetOnNavigation: true,
      });
      pages.add(page);
    });

    await use(context);

    await Promise.all(
      Array.from(pages.values()).flatMap(async (page, index) => {
        const coverage = await page.coverage.stopJSCoverage();
        const sourceFilePaths = [
          path.join(path.dirname(testInfo.file), '..', 'www', 'main.js'),
          path.join(
            path.dirname(testInfo.file),
            '..',
            'www',
            'static',
            'js',
            'index.js',
          ),
          ...getWebCoreMappedFiles(),
        ].filter((p) => existsSync(p));

        const coverageMapData = {};
        for (const sourceFilePath of sourceFilePaths) {
          const converter = v8ToIstanbul(sourceFilePath);
          await converter.load();

          for (const entry of coverage) {
            converter.applyCoverage(entry.functions);
          }

          Object.assign(coverageMapData, converter.toIstanbul());
        }

        return fs.writeFile(
          path.join(
            dir,
            `playwright_output_${
              testInfo.title.replaceAll('/', '_')
            }_${index}.json`,
          ),
          JSON.stringify(coverageMapData),
          { flag: 'w' },
        );
      }),
    );
  },
});

export { expect } from '@playwright/test';
