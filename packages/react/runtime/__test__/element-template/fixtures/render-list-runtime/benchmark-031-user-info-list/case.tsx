import { runListRuntimeFixture } from '../_shared.js';

export async function run() {
  return runListRuntimeFixture('benchmark-031-user-info-list', ({ listElement, mockNativePapi }) => {
    mockNativePapi.triggerComponentAtIndex(listElement, 0, 121);
    mockNativePapi.triggerComponentAtIndexes(listElement, [1, 2], [221, 321], false, false);
  });
}
