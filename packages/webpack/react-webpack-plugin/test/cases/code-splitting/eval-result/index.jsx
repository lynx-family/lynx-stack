/// <reference types="vitest/globals" />

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const importPromise = import('./foo.js');

it('should have processEvalResult', async () => {
  const { foo } = await importPromise;
  expect(foo()).toBe(42);

  const content = await readFile(__filename, 'utf-8');

  if (__LEPUS__) {
    expect(content).toContain(['globalThis', 'processEvalResult'].join('.'));
  } else {
    expect(content).not.toContain(
      ['globalThis', 'processEvalResult'].join('.'),
    );
  }
});

it('should allow result to be null', () => {
  if (!__LEPUS__) {
    return;
  }

  const ret = globalThis.processEvalResult(null, 'foo');
  expect(ret).toBeNull();
});

it('should allow result to be undefined', () => {
  if (!__LEPUS__) {
    return;
  }

  const ret = globalThis.processEvalResult(undefined, 'foo');
  expect(ret).toBeUndefined();
});

it('should allow result to return non-webpack chunk', () => {
  if (!__LEPUS__) {
    return;
  }

  const result = {};
  const fn = vi.fn();
  fn.mockReturnValue(result);

  const ret = globalThis.processEvalResult(fn, 'foo');
  expect(fn).toHaveBeenCalledWith('foo');
  expect(ret).toBe(result);
});

it('should allow result to return webpack chunk', () => {
  if (!__LEPUS__) {
    return;
  }

  const result = {
    ids: ['foo'],
    modules: {
      foo: vi.fn(),
    },
  };
  const fn = vi.fn();
  fn.mockReturnValue(result);

  __webpack_require__.C = (chunk) => {
    __webpack_modules__['foo'] = chunk.modules.foo;
    expect(chunk).toBe(result);
  };

  const ret = globalThis.processEvalResult(fn, 'foo');
  expect(fn).toHaveBeenCalledWith('foo');
  expect(ret).toBe(result);
  expect(result.modules.foo).toHaveBeenCalled();
});

it('should have async chunks', () => {
  const LAYER = __LEPUS__ ? 'react:main-thread' : 'react:background';

  expect(existsSync(
    join(__dirname, `foo.js-${LAYER}.js`),
  )).toBeTruthy();
});
