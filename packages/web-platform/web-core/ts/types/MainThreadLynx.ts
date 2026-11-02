/*
 * Copyright 2023 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */
import type { Cloneable } from './Cloneable.js';
import type { ExternalBundleLynxAPIs } from './ExternalBundle.js';
import type { LynxContextEventTarget } from './LynxContextEventTarget.js';
import type { LynxEngineContext } from './LynxEngineContext.js';
import type { LynxPerformance } from './NativeApp.js';
export interface MainThreadLynx extends ExternalBundleLynxAPIs {
  /**
   * Asynchronously evaluate a script from a previously fetched bundle and pass
   * its module exports to the callback, using the BTS `loadScriptAsync` signature.
   * This API is available in the browser main thread, but not during SSR.
   *
   * @param sectionPath - The script's path in the bundle.
   * @param callback - Receives `null` and the exports on success, or an error message on failure.
   * @param entryName - The bundle URL; defaults to the current view's template URL.
   */
  loadScriptAsync?(
    sectionPath: string,
    callback: (message: string | null, exports?: unknown) => void,
    entryName?: string,
  ): void;
  performance: LynxPerformance;
  getJSContext: () => LynxContextEventTarget;
  /**
   * The Engine context proxy. Buildless cards use it to subscribe to engine
   * lifecycle events (`__RenderPage`, `__UpdatePage`, `__DestroyLifetime`,
   * `__UpdateGlobalProps`) instead of exporting `globalThis.renderPage`.
   */
  getEngine: () => LynxEngineContext;
  requestAnimationFrame: (cb: () => void) => number;
  cancelAnimationFrame: (handler: number) => void;
  __globalProps: unknown;
  getCustomSectionSync: (key: string) => Cloneable;
  markPipelineTiming: (pipelineId: string, timingKey: string) => void;
  SystemInfo: Cloneable;
  setTimeout: typeof setTimeout;
  clearTimeout: typeof clearTimeout;
  setInterval: typeof setInterval;
  clearInterval: typeof clearInterval;
}
