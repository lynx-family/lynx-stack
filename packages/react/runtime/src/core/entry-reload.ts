// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { increaseReloadVersion } from './reload-version.js';
import { destroyRuntime } from './runtime-destroy.js';

const supportsReEvalKey = Symbol.for('__LYNX_ENTRY_SUPPORTS_RE_EVAL__');
const reloaderKey = Symbol.for('__LYNX_MAIN_THREAD_ENTRY_RELOADER__');
const completerKey = Symbol.for('__LYNX_MAIN_THREAD_RELOAD_COMPLETER__');
const externalGlobalKey = Symbol.for('__LYNX_EXTERNAL_GLOBAL__');

const host = () => lynx as unknown as Record<symbol, unknown>;

function isEntryReEvalEnabled(): boolean {
  return typeof __EXPERIMENTAL_RE_EVAL_JS_ON_RELOAD__ !== 'undefined'
    && __EXPERIMENTAL_RE_EVAL_JS_ON_RELOAD__
    && host()[supportsReEvalKey] === true;
}

export function canReEvalMainThreadEntry(): boolean {
  return isEntryReEvalEnabled() && typeof host()[reloaderKey] === 'function';
}

export function canReEvalBackgroundEntry(): boolean {
  return isEntryReEvalEnabled() && typeof lynx.getApp().reloadCard === 'function';
}

/** Lets the entry being evaluated finish a reload started by the previous one. */
export function installMainThreadReloadCompleter<Handoff>(complete: (handoff: Handoff) => void): void {
  if (
    typeof __MAIN_THREAD__ !== 'undefined' && __MAIN_THREAD__
    && typeof __EXPERIMENTAL_RE_EVAL_JS_ON_RELOAD__ !== 'undefined' && __EXPERIMENTAL_RE_EVAL_JS_ON_RELOAD__
  ) {
    host()[completerKey] = complete;
  }
}

export function reEvalMainThreadEntry<Handoff>(handoff: Handoff): void {
  // Evaluating the entry resets `__initData`.
  const initData = lynx.__initData;
  destroyRuntime();
  Reflect.deleteProperty(lynx, externalGlobalKey);
  (host()[reloaderKey] as () => void)();
  lynx.__initData = initData;
  (host()[completerKey] as (handoff: Handoff) => void)(handoff);
}

/** @param retire - stops this entry from sending work to the main thread */
export function reEvalBackgroundEntry(
  updateData: Record<string, unknown>,
  options: Record<string, unknown> | undefined,
  retire: () => void,
): void {
  const data = Object.assign({}, lynx.__initData, updateData);
  destroyRuntime();
  increaseReloadVersion();
  retire();
  const app = lynx.getApp();
  app.callDestroyLifetimeFun();
  Reflect.deleteProperty(lynx, externalGlobalKey);
  app.reloadCard!(data, options);
}
