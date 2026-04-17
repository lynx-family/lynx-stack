import { runListRuntimeFixture } from '../_shared.js';

export async function run() {
  return runListRuntimeFixture('benchmark-029-image-text-waterfall', ({ listElement, mockNativePapi }) => {
    mockNativePapi.triggerComponentAtIndex(listElement, 0, 101);
    mockNativePapi.triggerComponentAtIndexes(listElement, [0, 1], [201, 202], false, false);
  });
}
