/**
 * Vitest setup file for Vue runtime-dom upstream tests.
 *
 * Creates a LynxTestingEnv, wires up the dual-thread pipeline,
 * and initialises the runtime-dom bridge so patchProp calls route
 * through our BG→MT→PAPI→jsdom pipeline.
 *
 * This mirrors packages/vue/testing-library/setup.ts but adds the
 * bridge initialisation step.
 */

import { JSDOM } from 'jsdom';
import { LynxTestingEnv } from '@lynx-js/testing-environment';
import { initBridge, resetBridge } from './lynx-runtime-dom-bridge.js';

// --- Create the testing environment -----------------------------------------

const jsdom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
const lynxTestingEnv = new LynxTestingEnv(jsdom);

(globalThis as Record<string, unknown>)['lynxTestingEnv'] = lynxTestingEnv;

// --- Wire Main Thread globals -----------------------------------------------

lynxTestingEnv.switchToMainThread();

// Stub registerWorkletInternal — entry-main.ts may contain demo worklet
// registrations that require the worklet-runtime chunk (not available in tests).
if (
  typeof (globalThis as Record<string, unknown>)['registerWorkletInternal']
    === 'undefined'
) {
  (globalThis as Record<string, unknown>)['registerWorkletInternal'] = () => {};
}

// The main-thread entry-main.ts sets globalThis.renderPage, vuePatchUpdate, etc.
await import('@lynx-js/vue-main-thread');

// Capture the functions set on globalThis by entry-main.ts
const mainThreadFns = {
  renderPage: (globalThis as Record<string, unknown>)['renderPage'],
  vuePatchUpdate: (globalThis as Record<string, unknown>)['vuePatchUpdate'],
  processData: (globalThis as Record<string, unknown>)['processData'],
  updatePage: (globalThis as Record<string, unknown>)['updatePage'],
  updateGlobalProps:
    (globalThis as Record<string, unknown>)['updateGlobalProps'],
};

// Store on the main thread globalThis so they survive resets.
Object.assign(
  lynxTestingEnv.mainThread.globalThis as Record<string, unknown>,
  mainThreadFns,
);

// --- Import ops-apply internals for the bridge ------------------------------

// ops-apply.ts exports applyOps, elements, resetMainThreadState.
// Since it's the same Node.js process, module-level state is shared
// across thread contexts.
const { applyOps, elements, resetMainThreadState } = await import(
  '../../main-thread/src/ops-apply.js'
);

// --- Wire Background Thread globals ----------------------------------------

lynxTestingEnv.switchToBackgroundThread();

// Import entry-background which sets publishEvent on lynxCoreInject.tt and globalThis.
await import('@lynx-js/vue-runtime/entry-background');

// Capture the publishEvent function reference for re-wiring after resets.
const publishEventFn = (globalThis as Record<string, unknown>)['publishEvent'];

// Also store on the BG thread globalThis.
(lynxTestingEnv.backgroundThread.globalThis as Record<string, unknown>)[
  'publishEvent'
] = publishEventFn;

// --- Initialise the bridge --------------------------------------------------

initBridge({ applyOps, elements, resetMainThreadState });

// --- Hooks for post-reset re-wiring ----------------------------------------

(globalThis as Record<string, unknown>)['onSwitchedToMainThread'] = () => {
  Object.assign(globalThis, mainThreadFns);
};

(globalThis as Record<string, unknown>)['onSwitchedToBackgroundThread'] =
  () => {
    const g = globalThis as Record<string, unknown>;
    const inject = g['lynxCoreInject'] as
      | { tt?: Record<string, unknown> }
      | undefined;
    if (inject?.tt) {
      inject.tt['publishEvent'] = publishEventFn;
    }
    g['publishEvent'] = publishEventFn;
  };

// --- Per-test reset ---------------------------------------------------------

beforeEach(() => {
  // Reset bridge + runtime state
  resetBridge();

  // Clear jsdom body
  jsdom.window.document.body.innerHTML = '';
});

// Stay on background thread (tests start on BG by default).
