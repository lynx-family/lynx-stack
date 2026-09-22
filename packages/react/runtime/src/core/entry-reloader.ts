// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * The key of the main thread entry reloader installed by the bundler wrapper.
 *
 * When present, `reloadTemplate` re-evaluates the entry instead of reusing the
 * JSX of the previous render, so module scoped state of the entry is reset.
 */
const ENTRY_RELOADER: symbol = Symbol.for('__LYNX_MAIN_THREAD_ENTRY_RELOADER__');

type EntryReloader = () => void;

function getEntryReloader(): EntryReloader | undefined {
  return (globalThis as unknown as Record<symbol, EntryReloader | undefined>)[ENTRY_RELOADER];
}

/**
 * The key of the marker the bundler prepends to the background entry.
 *
 * When present, `reloadTemplate` hands the background back to Lynx core, which
 * evaluates the entry again, instead of re-rendering the JSX of the previous
 * render. The framework runs from a bundle of its own, built without knowing
 * whether the app asked for this, so the marker carries the answer at runtime.
 */
const BACKGROUND_ENTRY_REEVAL: symbol = Symbol.for('__LYNX_BACKGROUND_ENTRY_REEVAL__');

function isBackgroundEntryReevalEnabled(): boolean {
  return !!(globalThis as unknown as Record<symbol, boolean | undefined>)[BACKGROUND_ENTRY_REEVAL];
}

export { BACKGROUND_ENTRY_REEVAL, ENTRY_RELOADER, getEntryReloader, isBackgroundEntryReevalEnabled };
export type { EntryReloader };
