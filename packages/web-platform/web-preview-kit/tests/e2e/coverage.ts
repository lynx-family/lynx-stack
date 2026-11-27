// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * V8 coverage of the kit pages, as `@lynx-js/playwright-fixtures` collects it
 * for web-core-e2e. Each script is matched by its URL path to the built file
 * in `dist/kit`, converted with `v8-to-istanbul` through that file's source
 * map, and the sources under `src/` are written to
 * `packages/web-platform/.nyc_output/`, where `pnpm run coverage` reads them.
 *
 * Playwright does not report the scripts of workers, so `src/worker/` and
 * `src/sw/` are not measured.
 */

import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

import { test as base } from '@playwright/test';
import type { Page } from '@playwright/test';
import v8ToIstanbul from 'v8-to-istanbul';

import { coverageDir, coverageFilePrefix, packageDir } from './paths.js';

const sourceDir = `${path.join(packageDir, 'src')}${path.sep}`;
const distDir = path.join(packageDir, 'dist/kit');

let fileCount = 0;

/** Starts measuring a page; call it before the page navigates. */
export async function startCoverage(page: Page): Promise<void> {
  await page.coverage.startJSCoverage({ resetOnNavigation: false });
}

/** Stops measuring a page and writes the coverage of the kit's sources. */
export async function saveCoverage(page: Page, name: string): Promise<void> {
  await fs.mkdir(coverageDir, { recursive: true });
  for (const entry of await page.coverage.stopJSCoverage()) {
    const file = path.join(distDir, new URL(entry.url).pathname);
    if (!existsSync(`${file}.map`)) {
      continue;
    }
    const converter = v8ToIstanbul(
      file,
      0,
      undefined,
      source => !path.resolve(path.dirname(file), source).startsWith(sourceDir),
    );
    await converter.load();
    converter.applyCoverage(entry.functions);
    const data = converter.toIstanbul();
    converter.destroy();
    if (Object.keys(data).length > 0) {
      await fs.writeFile(
        path.join(
          coverageDir,
          `${coverageFilePrefix}${name}_${fileCount++}.json`,
        ),
        JSON.stringify(data),
      );
    }
  }
}

/** Playwright's `test`, with the coverage of every test's `page`. */
export const test: typeof base = base.extend({
  page: async ({ page }, use, testInfo) => {
    await startCoverage(page);
    await use(page);
    await saveCoverage(page, `${testInfo.testId}_${testInfo.retry}`);
  },
});

export { expect } from '@playwright/test';
