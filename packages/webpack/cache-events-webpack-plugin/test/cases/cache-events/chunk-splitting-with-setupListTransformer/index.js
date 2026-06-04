/// <reference types="@rstest/core/globals" />

import { add } from './lib-common.js';

// Captured at module-eval time: `onLoaded` clears `setupList` (and `cachedActions`)
// once startup settles to release the closures over `tt`/`globalThis`, so the
// registered setups can only be observed before load completes.
const setupNames = __webpack_require__['lynx_ce']['setupList'].map(
  (item) => item.name,
);

it('should append new setup list item', () => {
  expect(add(1, 2)).toBe(3);
  expect(__webpack_require__['lynx_ce']).toBeTruthy();
  expect(setupNames).toEqual([
    'ttMethod',
    'performanceEvent',
    'globalThis',
    'customCacheEvent',
  ]);
  expect(__webpack_require__['lynx_ce']['loaded']).toBe(true);
  // Released on load to avoid retaining mock closures (memory-leak fix).
  expect(__webpack_require__['lynx_ce']['setupList'].length).toBe(0);
  expect(__webpack_require__['lynx_ce']['cachedActions'].length).toBe(0);
});
