// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { SECTION_CSS, SECTION_MAIN_THREAD } from './lazyBundleConstants.js';
import { LifecycleConstant } from '../lifecycle/constant.js';

const cache = new Set<string>();

function prepareLazyBundleMTS(payload: { url: string }): void {
  const { url } = payload;
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
      loaded = lynx.loadScript(SECTION_MAIN_THREAD, {
        bundleName: response.url,
      });
    } catch {
      // BG-only bundle (no main-thread section)
      return;
    }
    const processEvalResult = (
      globalThis as unknown as {
        processEvalResult?: (
          result: ((schema: string) => unknown) | undefined,
          schema: string,
        ) => unknown;
      }
    ).processEvalResult;
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
