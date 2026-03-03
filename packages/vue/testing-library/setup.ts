/**
 * Vitest setup file for Vue Lynx testing library.
 *
 * Creates a LynxTestingEnv, wires up the dual-thread pipeline:
 * - Main Thread: renderPage, vuePatchUpdate (PAPI ops executor)
 * - Background Thread: publishEvent, lynx.getNativeApp().callLepusMethod
 *
 * This runs BEFORE any test module is imported, so by the time Vue's runtime
 * modules load, all ambient globals (lynx, lynxCoreInject, __MAIN_THREAD__, etc.)
 * are already in place.
 */

import { JSDOM } from 'jsdom';
import { LynxTestingEnv } from '@lynx-js/testing-environment';

// --- Create the testing environment -----------------------------------------

const jsdom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
const lynxTestingEnv = new LynxTestingEnv(jsdom);

// Expose globally so render() / fireEvent() can access it.
(globalThis as any).lynxTestingEnv = lynxTestingEnv;

// --- Wire Main Thread globals -----------------------------------------------

lynxTestingEnv.switchToMainThread();

// Stub registerWorkletInternal — entry-main.ts may contain demo worklet
// registrations that require the worklet-runtime chunk (not available in tests).
if (typeof (globalThis as any).registerWorkletInternal === 'undefined') {
  (globalThis as any).registerWorkletInternal = () => {};
}

// The main-thread entry-main.ts sets globalThis.renderPage, vuePatchUpdate, etc.
await import('@lynx-js/vue-main-thread');

// Capture the functions set on globalThis by entry-main.ts
const mainThreadFns = {
  renderPage: (globalThis as any).renderPage,
  vuePatchUpdate: (globalThis as any).vuePatchUpdate,
  processData: (globalThis as any).processData,
  updatePage: (globalThis as any).updatePage,
  updateGlobalProps: (globalThis as any).updateGlobalProps,
};

// Also store them on the main thread globalThis so they survive resets.
const mtGlobal = lynxTestingEnv.mainThread.globalThis as any;
Object.assign(mtGlobal, mainThreadFns);

// --- Wire Background Thread globals ----------------------------------------

lynxTestingEnv.switchToBackgroundThread();

// Import entry-background which sets publishEvent on lynxCoreInject.tt and globalThis.
await import('@lynx-js/vue-runtime/entry-background');

// Capture the publishEvent function reference for re-wiring after resets.
const publishEventFn = (globalThis as any).publishEvent;

// Also store on the BG thread globalThis.
const bgGlobal = lynxTestingEnv.backgroundThread.globalThis as any;
bgGlobal.publishEvent = publishEventFn;

// --- Hooks for post-reset re-wiring ----------------------------------------

// After lynxTestingEnv.reset(), the globals are re-injected from scratch.
// We need to re-set our custom functions (renderPage, vuePatchUpdate,
// publishEvent) because the fresh injectGlobals() doesn't know about them.

(globalThis as any).onSwitchedToMainThread = () => {
  // Re-install main-thread pipeline functions
  Object.assign(globalThis, mainThreadFns);
};

(globalThis as any).onSwitchedToBackgroundThread = () => {
  // Re-install publishEvent on lynxCoreInject.tt and globalThis
  if ((globalThis as any).lynxCoreInject?.tt) {
    (globalThis as any).lynxCoreInject.tt.publishEvent = publishEventFn;
  }
  (globalThis as any).publishEvent = publishEventFn;
};

// Stay on background thread (tests start on BG by default).
