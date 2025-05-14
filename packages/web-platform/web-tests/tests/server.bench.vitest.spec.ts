import { test, bench, expect, describe } from 'vitest';
import { createLynxView } from '@lynx-js/web-core-server';
import path from 'node:path';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'node:url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function readTemplate(name: string) {
  const file = await readFile(
    path.join(__dirname, `../dist/${name}/index.web.json`),
    'utf-8',
  );
  const rawTemplate = JSON.parse(file);
  return rawTemplate as any;
}
const cases = {
  'basic-performance-div-10000': await readTemplate(
    'basic-performance-div-10000',
  ),
  'basic-performance-div-1000': await readTemplate(
    'basic-performance-div-1000',
  ),
  'basic-performance-div-100': await readTemplate('basic-performance-div-100'),
  'basic-performance-div-10': await readTemplate('basic-performance-div-10'),
  'basic-performance-nest-level-100': await readTemplate(
    'basic-performance-nest-level-100',
  ),
};
describe('server-tests', () => {
  Object.entries(cases).forEach(([name, template]) => {
    bench(name, async () => {
      const lynxView = await createLynxView({
        browserConfig: {
          pixelRatio: 1,
          pixelWidth: 600,
          pixelHeight: 800,
        },
        tagMap: {},
        initData: {},
        globalProps: {},
        template,
        templateName: name,
      });
      await lynxView.renderToString();
    });
  });
});
