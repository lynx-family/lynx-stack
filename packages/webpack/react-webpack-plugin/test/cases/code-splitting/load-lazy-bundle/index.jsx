/// <reference types="vitest/globals" />

import { lazy } from '@lynx-js/react';

lazy(() => import('./foo.js'));

it('should have lynx.loadLazyBundle', () => {
  expect(lynx.loadLazyBundle).not.toBeUndefined();
});
