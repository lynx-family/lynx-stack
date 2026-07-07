// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { SECTION_CSS, SECTION_MAIN_THREAD } from './lazyBundleConstants.js';
import { LifecycleConstant } from '../lifecycle/constant.js';

const cache = new Set<string>();

function prepareLazyBundleMTS(payload: { url: string; host?: string }): void {
  const { url, host } = payload;
  if (cache.has(url)) return;
  cache.add(url);
  let handler;
  try {
    handler = lynx.fetchBundle(url, {});
  } catch {
    return;
  }
  // .then will be a sync function
  // since the bundle has been loaded in BTS
  handler.then((response) => {
    if (!response || response.code !== 0) return;
    let loaded: unknown;
    try {
      const evaluate = lynx.loadScript<(entry: string) => unknown>(
        SECTION_MAIN_THREAD,
        { bundleName: response.url },
      );
      loaded = evaluate(url);
    } catch {
      // BG-only bundle (no main-thread section)
      return;
    }
    // Route to the loading `host`'s handler — the chunk's modules install into
    // that host's registry. No host (e.g. a standalone component loaded
    // directly, self-contained in its own registry) → nothing to install here.
    const processEvalResult = host == null
      ? undefined
      : (
        globalThis as unknown as {
          processEvalResultByHost?: Record<
            string,
            (result: (schema: string) => unknown, schema: string) => unknown
          >;
        }
      ).processEvalResultByHost?.[host];
    if (typeof processEvalResult === 'function') {
      processEvalResult(() => loaded, url);
    }
    const styleSheet = __LoadStyleSheet(SECTION_CSS, response.url);
    if (styleSheet !== null) __AdoptStyleSheet(styleSheet);
  });
}

/** @internal */
export function injectPrepareLazyBundleMTS(): void {
  Object.assign(globalThis, {
    [LifecycleConstant.prepareLazyBundleMTS]: prepareLazyBundleMTS,
  });
}
