// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { NativeApp } from '../../../../types/index.js';
import type { Rpc } from '@lynx-js/web-worker-rpc';
import { disposeEndpoint } from '../../../endpoints.js';

export function registerDisposeHandler(
  rpc: Rpc,
  nativeApp: NativeApp,
  destroyCard: typeof import('@lynx-js/lynx-core/web')['destroyCard'],
  callDestroyLifetimeFun:
    typeof import('@lynx-js/lynx-core/web')['callDestroyLifetimeFun'],
): void {
  rpc.registerHandler(disposeEndpoint, () => {
    const id = nativeApp.id;
    // `callDestroyLifetimeFun` forwards to `tt.callDestroyLifetimeFun`, which is
    // injected by the ReactLynx background runtime (`injectTt`). Buildless
    // (vanilla / Lynx XML markup) cards run their own background script and
    // never install that hook, so lynx-core throws
    // "callDestroyLifetimeFun is not a function" for them. The framework
    // lifetime callback is optional, but `destroyCard` — which tears the app
    // down and drops it from `nativeGlobal.multiApps` — is not, so the throw
    // must not be allowed to skip it.
    try {
      callDestroyLifetimeFun(id);
    } catch (e) {
      // Nothing to report when the card simply has no framework lifetime hook;
      // a genuine failure inside a framework's callback is still surfaced.
      if (!isMissingLifetimeHookError(e)) {
        console.error(
          '[lynx-web] error while calling the card destroy lifetime hook',
          e,
        );
      }
    }
    destroyCard(id);
  });
}

/**
 * Whether `error` is lynx-core complaining that the card never installed
 * `tt.callDestroyLifetimeFun`, as opposed to a framework lifetime callback
 * failing on its own.
 */
function isMissingLifetimeHookError(error: unknown): boolean {
  if (!(error instanceof TypeError)) {
    return false;
  }
  // Match the "not callable" shape engines produce for a missing member, rather
  // than the mere mention of the name: a framework callback that itself throws
  // a `TypeError` naming the hook must still be reported, not swallowed.
  // Covers V8 ("... is not a function"), SpiderMonkey ("... is not a function")
  // and JavaScriptCore ("... is not a function. (In '...')").
  return /callDestroyLifetimeFun[\s\S]*?\bis not a function\b/
    .test(error.message);
}
