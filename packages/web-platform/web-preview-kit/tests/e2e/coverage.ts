// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * The `test` of every spec: Playwright's, with V8 coverage of the pages, as
 * `@lynx-js/playwright-fixtures` collects it for web-core-e2e.
 *
 * Every page records its JavaScript coverage. At the end of a test, each
 * script is matched to the built file it was served from by its URL (see
 * {@link serveForCoverage}), converted with `v8-to-istanbul` through that
 * file's source map, and the sources under `src/` are written to
 * `packages/web-platform/.nyc_output/`, where `pnpm run coverage` reads them.
 *
 * Only the main thread of a page is measured: Playwright does not report
 * the scripts of workers, so `src/worker/` and `src/sw/` are not in the
 * report.
 */

import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

import { test as base } from '@playwright/test';
import type { Page } from '@playwright/test';
import v8ToIstanbul from 'v8-to-istanbul';

import { coverageDir, coverageFilePrefix, packageDir } from './paths.js';

const sourceDir = `${path.join(packageDir, 'src')}${path.sep}`;

/** Origin to the function that maps a URL path to the file it serves. */
const servers = new Map<string, (pathname: string) => string | undefined>();

/** Records which files an origin serves, so its scripts can be mapped. */
export function serveForCoverage(
  origin: string,
  fileOf: (pathname: string) => string | undefined,
): void {
  servers.set(origin, fileOf);
}

/** Forgets an origin. */
export function stopServingForCoverage(origin: string): void {
  servers.delete(origin);
}

/**
 * The built file a script URL was served from, when it has a source map
 * with sources of this package. Files are checked when the script is
 * converted, so a server that is closed by then is still known.
 */
function builtFileOf(url: string, known: Map<string, string | undefined>) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return undefined;
  }
  return known.get(`${parsed.origin}${parsed.pathname}`);
}

const mapsSources = new Map<string, Promise<boolean>>();

/** Whether the source map of `file` has a source under `src/`. */
function hasPackageSources(file: string): Promise<boolean> {
  let result = mapsSources.get(file);
  if (!result) {
    result = fs.readFile(`${file}.map`, 'utf8').then((text) => {
      const { sources } = JSON.parse(text) as { sources: string[] };
      return sources.some(source =>
        path.resolve(path.dirname(file), source).startsWith(sourceDir)
      );
    }, () => false);
    mapsSources.set(file, result);
  }
  return result;
}

const started = new WeakMap<Page, Promise<void>>();

export const test: typeof base = base.extend({
  context: async ({ browserName, context }, use, testInfo) => {
    if (browserName !== 'chromium') {
      await use(context);
      return;
    }
    const pages: Page[] = [];
    /** Script URL to built file, for every script of a known origin. */
    const known = new Map<string, string | undefined>();
    const record = (page: Page) => {
      pages.push(page);
      page.on('request', (request) => {
        const url = new URL(request.url());
        const fileOf = servers.get(url.origin);
        if (fileOf) {
          known.set(`${url.origin}${url.pathname}`, fileOf(url.pathname));
        }
      });
      started.set(
        page,
        page.coverage.startJSCoverage({ resetOnNavigation: false }),
      );
    };
    context.pages().forEach(record);
    context.on('page', record);

    await use(context);

    await fs.mkdir(coverageDir, { recursive: true });
    let index = 0;
    for (const page of pages) {
      // A page the test closed has lost its coverage.
      const entries = await page.coverage.stopJSCoverage().catch(() => []);
      for (const entry of entries) {
        const file = builtFileOf(entry.url, known);
        if (!file || !existsSync(file) || !(await hasPackageSources(file))) {
          continue;
        }
        // A script that ran before coverage started, such as the script of
        // a popup, has no range for the script itself and misses the
        // functions it ran. v8-to-istanbul would count all its lines as
        // run.
        if (
          !entry.functions.some(fn =>
            fn.ranges[0]?.startOffset === 0 && fn.functionName === ''
          )
        ) {
          continue;
        }
        const converter = v8ToIstanbul(
          file,
          0,
          undefined,
          source =>
            !path.resolve(path.dirname(file), source).startsWith(sourceDir),
        );
        await converter.load();
        converter.applyCoverage(entry.functions);
        const data = converter.toIstanbul();
        converter.destroy();
        await fs.writeFile(
          path.join(
            coverageDir,
            `${coverageFilePrefix}${testInfo.testId}_${testInfo.retry}_${index++}.json`,
          ),
          JSON.stringify(data),
        );
      }
    }
  },
  page: async ({ page }, use) => {
    // Coverage starts before the test navigates.
    await started.get(page);
    await use(page);
  },
});

export { expect } from '@playwright/test';
