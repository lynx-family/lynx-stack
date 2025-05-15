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
  bench('basic-performance-div-10000', async () => {
    const lynxView = createLynxView({
      browserConfig: {
        pixelRatio: 1,
        pixelWidth: 600,
        pixelHeight: 800,
      },
      tagMap: {},
      initData: {},
      globalProps: {},
      template: cases['basic-performance-div-10000'],
    });
    await lynxView.renderToString();
  });
  bench('basic-performance-div-1000', async () => {
    const lynxView = createLynxView({
      browserConfig: {
        pixelRatio: 1,
        pixelWidth: 600,
        pixelHeight: 800,
      },
      tagMap: {},
      initData: {},
      globalProps: {},
      template: cases['basic-performance-div-1000'],
    });
    await lynxView.renderToString();
  });
  bench('basic-performance-div-100', async () => {
    const lynxView = createLynxView({
      browserConfig: {
        pixelRatio: 1,
        pixelWidth: 600,
        pixelHeight: 800,
      },
      tagMap: {},
      initData: {},
      globalProps: {},
      template: cases['basic-performance-div-100'],
    });
    await lynxView.renderToString();
  });
  bench('basic-performance-div-10', async () => {
    const lynxView = createLynxView({
      browserConfig: {
        pixelRatio: 1,
        pixelWidth: 600,
        pixelHeight: 800,
      },
      tagMap: {},
      initData: {},
      globalProps: {},
      template: cases['basic-performance-div-10'],
    });
    await lynxView.renderToString();
  });
  bench('basic-performance-nest-level-100', async () => {
    const lynxView = createLynxView({
      browserConfig: {
        pixelRatio: 1,
        pixelWidth: 600,
        pixelHeight: 800,
      },
      tagMap: {},
      initData: {},
      globalProps: {},
      template: cases['basic-performance-nest-level-100'],
    });
    await lynxView.renderToString();
  });
});
