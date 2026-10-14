import { unused } from './unused.js';

console.info('entry without main-thread programmability');

export function exportedButUnused() {
  return unused();
}
