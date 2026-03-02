// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { queuePostFlushCb } from '@vue/runtime-core';

import { takeOps } from './ops.js';

/**
 * Schedule a flush of the ops buffer via Vue's post-flush hook.
 *
 * queuePostFlushCb fires after all reactive effects and component renders in
 * the current scheduler tick have completed.  We batch all DOM ops from one
 * reactive "tick" into a single callLepusMethod call, minimising cross-thread
 * traffic.
 */

// `lynx` is injected by RuntimeWrapperWebpackPlugin as a parameter to the
// tt.define() AMD callback – it is NOT on globalThis.  Declare it as an
// ambient variable so TypeScript accepts the bare identifier reference.
// eslint-disable-next-line no-var
declare var lynx:
  | {
    getNativeApp():
      | {
        callLepusMethod(
          method: string,
          params: unknown,
          callback: () => void,
        ): void;
      }
      | null
      | undefined;
  }
  | null
  | undefined;

let scheduled = false;

export function scheduleFlush(): void {
  if (scheduled) return;
  scheduled = true;
  queuePostFlushCb(doFlush);
}

function doFlush(): void {
  scheduled = false;
  const ops = takeOps();
  console.info(
    '[vue-bg] doFlush: ops.length=',
    ops.length,
    'lynx type:',
    typeof lynx,
  );
  if (ops.length === 0) return;
  // Temporary: log first 300 chars of ops to verify SET_EVENT (op code 6) is present
  // `lynx` is the Lynx BG runtime object injected by RuntimeWrapperWebpackPlugin
  // as a closure parameter – access it as a bare identifier, NOT via globalThis.
  const app = lynx?.getNativeApp?.();
  console.info(
    '[vue-bg] doFlush: getNativeApp()=',
    app == null ? String(app) : 'object',
  );
  app?.callLepusMethod?.(
    'vuePatchUpdate',
    { data: JSON.stringify(ops) },
    () => {
      console.info('[vue-bg] doFlush: callLepusMethod ack');
    },
  );
}
