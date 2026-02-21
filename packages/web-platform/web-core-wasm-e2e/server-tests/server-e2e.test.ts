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

test('executeTemplate should run lepusCode.root from basic-element-text-baseline.web.bundle', async () => {
  await runSnapshotTest('basic-element-text-baseline.web.bundle');
});

test('executeTemplate should run lepusCode.root from basic-scroll-view.web.bundle', async () => {
  await runSnapshotTest('basic-scroll-view.web.bundle');
});

test('executeTemplate should run lepusCode.root from basic-element-x-audio-tt-play.web.bundle', async () => {
  await runSnapshotTest('basic-element-x-audio-tt-play.web.bundle');
});

test('executeTemplate should run lepusCode.root from basic-element-image-src.web.bundle', async () => {
  await runSnapshotTest('basic-element-image-src.web.bundle');
});

test('executeTemplate should run lepusCode.root from basic-element-x-input-value.web.bundle', async () => {
  await runSnapshotTest('basic-element-x-input-value.web.bundle');
});

test('executeTemplate should run lepusCode.root from basic-element-list-basic.web.bundle', async () => {
  await runSnapshotTest('basic-element-list-basic.web.bundle');
});

test('executeTemplate should run lepusCode.root from basic-element-x-overlay-ng-demo.web.bundle', async () => {
  await runSnapshotTest('basic-element-x-overlay-ng-demo.web.bundle');
});

test('executeTemplate should run lepusCode.root from basic-element-x-refresh-view-demo.web.bundle', async () => {
  await runSnapshotTest('basic-element-x-refresh-view-demo.web.bundle');
});

test('executeTemplate should run lepusCode.root from basic-element-svg-with-css.web.bundle', async () => {
  await runSnapshotTest('basic-element-svg-with-css.web.bundle');
});

test('executeTemplate should run lepusCode.root from basic-element-x-swiper-autoplay.web.bundle', async () => {
  await runSnapshotTest('basic-element-x-swiper-autoplay.web.bundle');
});

test('executeTemplate should run lepusCode.root from basic-element-text-color.web.bundle', async () => {
  await runSnapshotTest('basic-element-text-color.web.bundle');
});

test('executeTemplate should run lepusCode.root from basic-element-x-textarea-placeholder.web.bundle', async () => {
  await runSnapshotTest('basic-element-x-textarea-placeholder.web.bundle');
});

test('executeTemplate should run lepusCode.root from basic-element-x-viewpager-ng-bindchange.web.bundle', async () => {
  await runSnapshotTest('basic-element-x-viewpager-ng-bindchange.web.bundle');
});
