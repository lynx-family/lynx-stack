// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Background Thread bootstrap entry.
 *
 * Injected by @lynx-js/vue-rsbuild-plugin as the first import of every
 * background bundle.  Sets up event routing so that native-dispatched events
 * reach our Vue handlers.
 *
 * Lynx routes native events via lynxCoreInject.tt.publishEvent (not
 * globalThis.publishEvent), so we must assign to both to cover all versions.
 */

import { publishEvent } from './event-registry.js';

// `lynxCoreInject` is injected by RuntimeWrapperWebpackPlugin as a parameter
// of the outer __init_card_bundle__ function – it is available as a bare
// identifier inside every module that runs in the AMD callback.
// eslint-disable-next-line no-var
declare var lynxCoreInject:
  | {
    tt?: {
      publishEvent?: (handlerName: string, data: unknown) => void;
      [key: string]: unknown;
    };
  }
  | null
  | undefined;

const g = globalThis as Record<string, unknown>;

console.info(
  '[vue-bg] entry-background init, lynxCoreInject type:',
  typeof lynxCoreInject,
);

// Primary path: lynxCoreInject.tt.publishEvent (used by modern Lynx)
if (typeof lynxCoreInject !== 'undefined' && lynxCoreInject?.tt) {
  console.info('[vue-bg] setting lynxCoreInject.tt.publishEvent');
  lynxCoreInject.tt.publishEvent = publishEvent;
  lynxCoreInject.tt['publicComponentEvent'] = (
    _cid: string,
    sign: string,
    data: unknown,
  ) => {
    console.info('[vue-bg] publicComponentEvent sign:', sign);
    publishEvent(sign, data);
  };
} else {
  console.info(
    '[vue-bg] lynxCoreInject.tt NOT available, falling back to globalThis only',
  );
}

// Fallback: some older Lynx SDKs call globalThis.publishEvent directly
g['publishEvent'] = publishEvent;
console.info('[vue-bg] globalThis.publishEvent set');

// updatePage – Vue's reactivity handles all updates automatically.
g['updatePage'] = function(_data: unknown): void {
  // no-op for MVP
};
