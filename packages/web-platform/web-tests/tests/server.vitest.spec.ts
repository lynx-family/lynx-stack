import { test, expect, describe } from 'vitest';
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
describe('server-tests', () => {
  test('basic-performance-div-10000', async ({ task }) => {
    const testName = task.name;
    const rawTemplate = await readTemplate(testName);
    const lynxView = createLynxView({
      browserConfig: {
        pixelRatio: 1,
        pixelHeight: 800,
        pixelWidth: 375,
      },
      tagMap: {},
      initData: {},
      globalProps: {},
      template: rawTemplate,
    });

    const html = await lynxView.renderToString();
    expect(html).toMatchSnapshot();
  });
});
