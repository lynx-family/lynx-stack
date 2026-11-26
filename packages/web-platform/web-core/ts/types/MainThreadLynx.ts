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
import type { MainThreadModule } from './NativeModules.js';
/** The DevTool APIs of the main-thread `lynx`. */
export interface MainThreadDevtool {
  /**
   * Replaces the style sheets of an entry with the StyleInfo of
   * `base64Bundle`, a base64 encoded web bundle.
   *
   * @param cssId - The CSS id that changed. On web the whole entry is
   * replaced, because the bundle holds all the CSS of its template.
   * @param base64Bundle - The web bundle encoded for the CSS hot update.
   * @param entry - The lazy bundle url, or `'__Card__'` or `undefined` for
   * the card.
   */
  replaceStyleSheetByIdWithBase64(
    cssId: number,
    base64Bundle: string,
    entry?: string,
  ): void;
}

export interface MainThreadLynx extends ExternalBundleLynxAPIs {
  /** Returns the current view's host-provided module, or undefined when unavailable. */
  module(name: string): MainThreadModule | undefined;
  performance: LynxPerformance;
  getJSContext: () => LynxContextEventTarget;
  /**
   * The Engine context proxy. Buildless cards use it to subscribe to engine
   * lifecycle events (`__RenderPage`, `__UpdatePage`, `__DestroyLifetime`,
   * `__UpdateGlobalProps`) instead of exporting `globalThis.renderPage`.
   */
  getEngine: () => LynxEngineContext;
  /**
   * The DevTool APIs available on the main thread. The CSS hot update runtime
   * of `@lynx-js/css-extract-webpack-plugin` uses it to replace style sheets.
   */
  getDevtool: () => MainThreadDevtool;
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
