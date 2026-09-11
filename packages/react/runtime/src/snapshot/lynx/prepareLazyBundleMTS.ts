// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { SECTION_CSS, SECTION_MAIN_THREAD } from './lazyBundleConstants.js';
import { LifecycleConstant } from '../lifecycle/constant.js';

const cache = new Set<string>();

function prepareLazyBundleMTS(payload: { url: string; host?: string }): void {
  const { url, host } = payload;
  if (cache.has(url)) return;
  let handler;
  try {
    handler = lynx.fetchBundle(url, { isLazyBundle: true });
  } catch {
    // fetchBundle threw — the bundle never loaded. Leave `url` out of the
    // cache so a later prepare for the same url can retry.
    return;
  }
  // .then will be a sync function
  // since the bundle has been loaded in BTS
  handler.then((response) => {
    if (!response || response.code !== 0) return;
    // The bundle is now loaded in native (code === 0), so the native SDK
    // won't re-eval it. Only now mark it done — caching earlier would have
    // pinned a failed fetch/non-zero response and blocked the retry above.
    // A subsequent `loadScript` throw below is a BG-only bundle (deterministic,
    // not retryable), so caching here is still correct.
    cache.add(url);
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
    if (
      typeof __LoadStyleSheet === 'function'
      && typeof __AdoptStyleSheet === 'function'
    ) {
      const styleSheet = __LoadStyleSheet(SECTION_CSS, response.url);
      if (styleSheet !== null) __AdoptStyleSheet(styleSheet);
    }
  });
}

/** @internal */
export function injectPrepareLazyBundleMTS(): void {
  Object.assign(globalThis, {
    [LifecycleConstant.prepareLazyBundleMTS]: prepareLazyBundleMTS,
  });
}
