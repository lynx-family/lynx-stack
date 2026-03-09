/// <reference types="vitest/globals" />

import { existsSync } from 'node:fs';
import path from 'node:path';

import { foo } from './shared/foo.js';
import { bar } from './shared/bar.js';

it('should not have debug-info.json emitted', () => {
  expect(existsSync(
    path.resolve(__dirname, '.rspeedy/main/debug-info.json'),
  )).toBeFalsy();
});

it('should not have tasm.json emitted', () => {
  expect(existsSync(
    path.resolve(__dirname, '.rspeedy/main/tasm.json'),
  )).toBeFalsy();
});

it('should not remove initial chunks', () => {
  expect(foo()).toBe(42);
  expect(bar()).toBe(42);
});

it('should not remove async chunks', async () => {
  const { baz } = await import(
    './async/baz.js'
  );

  expect(baz()).toBe(42);
});
