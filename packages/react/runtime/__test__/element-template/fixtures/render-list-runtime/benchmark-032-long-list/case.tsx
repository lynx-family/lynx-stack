import { runListRuntimeFixture } from '../_shared.js';

export async function run() {
  return runListRuntimeFixture('benchmark-032-long-list', ({ listElement, mockNativePapi }) => {
    mockNativePapi.triggerComponentAtIndex(listElement, 0, 131);
    mockNativePapi.triggerComponentAtIndexes(listElement, [1, 2], [231, 331], false, false);
  });
}
