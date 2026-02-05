import { test, expect } from 'vitest';
import * as path from 'path';
import { executeTemplate } from '@lynx-js/web-core-wasm/server';

test('executeTemplate should run lepusCode.root from dist artifact', async () => {
  const distDir = path.join(__dirname, '../dist');
  // Using api-globalThis.web.bundle as example
  const bundlePath = path.join(distDir, 'api-globalThis.web.bundle');
  const context = await executeTemplate(bundlePath);

  expect(context).toBeDefined();
  expect(context.module.exports).toBeDefined();
});
