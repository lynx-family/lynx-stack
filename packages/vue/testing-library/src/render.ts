/**
 * render() — mounts a Vue component through the full dual-thread pipeline and
 * returns a container element (JSDOM) with @testing-library/dom queries.
 *
 * Pipeline:
 *   1. Switch to Main Thread → renderPage() → creates PAPI page root (id=1)
 *   2. Switch to BG Thread → resetForTesting() → createApp(component).mount()
 *   3. Vue's scheduler runs synchronously:
 *      queuePostFlushCb(doFlush) → callLepusMethod('vuePatchUpdate', ops)
 *      → LynxTestingEnv switches to MT → applyOps(ops) → PAPI → JSDOM
 *   4. Return the JSDOM container with RTL queries
 */

import type { Component } from '@vue/runtime-core';
import { getQueriesForElement } from '@testing-library/dom';
import { createApp, resetForTesting, nextTick } from '@lynx-js/vue-runtime';
import type { VueLynxApp } from '@lynx-js/vue-runtime';

let currentApp: VueLynxApp | null = null;

export interface RenderResult {
  /** The JSDOM root element (page element) containing all rendered children. */
  container: Element;
  /** Unmount the current Vue app. */
  unmount: () => void;
  /** Re-render with a new root component. */
  rerender: (
    component: Component,
    props?: Record<string, unknown>,
  ) => RenderResult;
  /** @testing-library/dom queries bound to the container */
  [key: string]: any;
}

export function cleanup(): void {
  if (currentApp) {
    const env = (globalThis as any).lynxTestingEnv;
    env.switchToBackgroundThread();
    currentApp.unmount();
    currentApp = null;
  }
}

export function render(
  rootComponent: Component,
  rootProps?: Record<string, unknown>,
): RenderResult {
  const env = (globalThis as any).lynxTestingEnv;

  // 1. Cleanup previous render
  cleanup();

  // 2. Clear JSDOM body so previous render's elements are gone
  env.switchToMainThread();
  const doc = env.jsdom.window.document;
  doc.body.innerHTML = '';

  // 3. Call renderPage to create page root (id=1)
  const renderPage = (globalThis as any).renderPage;
  if (typeof renderPage === 'function') {
    renderPage({});
  }

  // 4. Switch to BG Thread, reset state, mount Vue app
  env.switchToBackgroundThread();
  resetForTesting();

  const app = createApp(rootComponent, rootProps);
  currentApp = app;

  // mount() is synchronous. Inside mount:
  //   - Vue renders the component tree → pushes ops
  //   - scheduleFlush() → queuePostFlushCb(doFlush)
  //   - Vue's scheduler tick completes → doFlush fires
  //   - doFlush calls lynx.getNativeApp().callLepusMethod('vuePatchUpdate', ...)
  //   - LynxTestingEnv's callLepusMethod switches to MT, applies ops, switches back
  // So after mount() returns, JSDOM already has the rendered elements.
  app.mount();

  // 5. Get the container from the main thread's JSDOM
  env.switchToMainThread();
  const container = doc.body.firstElementChild || doc.body;

  // Switch back to BG for test assertions (matching React testing lib convention)
  env.switchToBackgroundThread();

  const result: RenderResult = {
    container,
    unmount: () => cleanup(),
    rerender: (component: Component, props?: Record<string, unknown>) =>
      render(component, props),
    ...getQueriesForElement(container),
  };

  return result;
}

/**
 * Wait for all pending Vue reactive updates to flush through the pipeline.
 * Use this after programmatic state changes (ref.value = X) that happen
 * outside of event handlers.
 */
export async function waitForUpdate(): Promise<void> {
  const env = (globalThis as any).lynxTestingEnv;
  env.switchToBackgroundThread();
  await nextTick();
  await nextTick();
}
