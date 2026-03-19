import { bench, describe } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import { executeTemplate } from '@lynx-js/web-core-wasm/server';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function loadTemplate(name: string) {
  const bundlePath = path.resolve(__dirname, `../dist/${name}.web.bundle`);
  return fs.readFileSync(bundlePath);
}

const cases = {
  'basic-performance-div-10000': await loadTemplate(
    'basic-performance-div-10000',
  ),
  'basic-performance-div-1000': await loadTemplate(
    'basic-performance-div-1000',
  ),
  'basic-performance-div-100': await loadTemplate('basic-performance-div-100'),
  'basic-performance-nest-level-100': await loadTemplate(
    'basic-performance-nest-level-100',
  ),
  'basic-performance-image-100': await loadTemplate(
    'basic-performance-image-100',
  ),
  'basic-performance-scroll-view-100': await loadTemplate(
    'basic-performance-scroll-view-100',
  ),
  'basic-performance-text-200': await loadTemplate(
    'basic-performance-text-200',
  ),
  'basic-performance-large-css': await loadTemplate(
    'basic-performance-large-css',
  ),
  'basic-performance-small-css': await loadTemplate(
    'basic-performance-small-css',
  ),
};

describe('server-bench', () => {
  for (const [testName, rawTemplate] of Object.entries(cases)) {
    bench(testName, async () => {
      await executeTemplate(
        rawTemplate,
        {}, // initData
        {}, // globalProps
        {}, // initI18nResources
      );
    });
  }
});
