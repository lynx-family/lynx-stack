import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { test as base } from '@playwright/test';
import type { Page } from '@playwright/test';
import v8ToIstanbul from 'v8-to-istanbul';

const __dirname = fileURLToPath(import.meta.url);

export const test: typeof base = base.extend({
  context: async ({ browserName, context }, use, testInfo) => {
    if (browserName !== 'chromium') {
      // Coverage is not supported on non-chromium browsers
      return use(context);
    }

    const pages = new Set<Page>();

    context.on('page', async (page) => {
      await page.coverage.startJSCoverage({
        reportAnonymousScripts: true,
        resetOnNavigation: true,
      });
      pages.add(page);
    });

    await use(context);

    const dir = path.join(__dirname, '..', '..', '..', '.nyc_output');
    await fs.mkdir(dir, { recursive: true });

    await Promise.all(
      Array.from(pages.values()).flatMap(async (page, index) => {
        const coverage = await page.coverage.stopJSCoverage();

        const converter = v8ToIstanbul(
          path.join(__dirname, '..', '..', 'www', 'main.js'),
        );
        await converter.load();

        for (const entry of coverage) {
          converter.applyCoverage(entry.functions);
        }

        const coverageMapData = converter.toIstanbul();

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
