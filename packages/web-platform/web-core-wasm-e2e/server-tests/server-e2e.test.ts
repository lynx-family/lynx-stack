import { test, expect } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import { format } from 'prettier';
import { executeTemplate } from '@lynx-js/web-core-wasm/server';

async function runSnapshotTest(bundleName: string) {
  const distDir = path.resolve(__dirname, '../dist');
  const bundlePath = path.join(distDir, bundleName);
  const buffer = fs.readFileSync(bundlePath);
  const result = await executeTemplate(
    buffer,
    {}, // initData
    {}, // globalProps
    {}, // initI18nResources
  );

  expect(result).toBeDefined();
  expect(typeof result).toBe('string');

  const formatted = await format(result, { parser: 'html' });
  expect(formatted).toMatchSnapshot();
}

test('executeTemplate should run lepusCode.root from basic-pink-rect.web.bundle', async () => {
  await runSnapshotTest('basic-pink-rect.web.bundle');
});

test('executeTemplate should run lepusCode.root from config-css-default-display-linear-false.web.bundle', async () => {
  await runSnapshotTest('config-css-default-display-linear-false.web.bundle');
});

test('executeTemplate should run lepusCode.root from config-css-remove-scope-false-display-linear.web.bundle', async () => {
  await runSnapshotTest(
    'config-css-remove-scope-false-display-linear.web.bundle',
  );
});

test('executeTemplate should run lepusCode.root from config-css-selector-false-remove-css-and-style-collapsed.web.bundle', async () => {
  await runSnapshotTest(
    'config-css-selector-false-remove-css-and-style-collapsed.web.bundle',
  );
});
