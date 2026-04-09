/// <reference types="vitest/globals" />

import ReactLynx, { __runInJS } from '@lynx-js/react-runtime';

it('should have __runInJS as named export', () => {
  expect(__runInJS).toStrictEqual(expect.any(Function));
  if (__LEPUS__) {
    // The call expression will be removed
    expect(__runInJS(42)).toBeUndefined();
  } else {
    expect(__runInJS(42)).toBe(42);
  }
});

it('should have __runInJS in the default export', () => {
  expect(ReactLynx).toHaveProperty('__runInJS', expect.any(Function));
  if (__LEPUS__) {
    // The call expression will be removed
    expect(ReactLynx.__runInJS(42)).toBeUndefined();
  } else {
    expect(ReactLynx.__runInJS(42)).toBe(42);
  }
});
