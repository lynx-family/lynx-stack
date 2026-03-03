/**
 * @lynx-js/vue-testing-library
 *
 * Testing utilities for Vue 3 Lynx apps. Provides render(), cleanup(),
 * fireEvent, and re-exports from @testing-library/dom.
 */

export { render, cleanup, waitForUpdate } from './render.js';
export type { RenderResult } from './render.js';
export { fireEvent, eventMap } from './fire-event.js';
export { screen, within, getQueriesForElement } from '@testing-library/dom';

import { cleanup } from './render.js';

// Auto-cleanup after each test (matches @testing-library/react convention).
if (typeof afterEach === 'function') {
  afterEach(() => {
    cleanup();
    (globalThis as any).lynxTestingEnv?.reset();
  });
}
