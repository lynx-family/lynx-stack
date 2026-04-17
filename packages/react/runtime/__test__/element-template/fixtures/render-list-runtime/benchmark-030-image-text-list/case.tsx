import { runListRuntimeFixture } from '../_shared.js';

export async function run() {
  return runListRuntimeFixture('benchmark-030-image-text-list', ({ listElement, mockNativePapi }) => {
    mockNativePapi.triggerComponentAtIndex(listElement, 0, 111);
    mockNativePapi.triggerComponentAtIndexes(listElement, [1, 2], [211, 311], false, false);
  });
}
