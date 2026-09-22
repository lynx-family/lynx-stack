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

export { ENTRY_RELOADER, getEntryReloader };
export type { EntryReloader };
