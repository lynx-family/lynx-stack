// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { queuePostFlushCb } from '@vue/runtime-core'

import { takeOps } from './ops.js'

/**
 * Schedule a flush of the ops buffer via Vue's post-flush hook.
 *
 * queuePostFlushCb fires after all reactive effects and component renders in
 * the current scheduler tick have completed.  We batch all DOM ops from one
 * reactive "tick" into a single callLepusMethod call, minimising cross-thread
 * traffic.
 */

let scheduled = false

export function scheduleFlush(): void {
  if (scheduled) return
  scheduled = true
  queuePostFlushCb(doFlush)
}

function doFlush(): void {
  scheduled = false
  const ops = takeOps()
  if (!ops.length) return
  // lynx is a global injected by the Lynx BG runtime.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = globalThis as any
  g.lynx?.getNativeApp?.()?.callLepusMethod?.(
    'vuePatchUpdate',
    { data: JSON.stringify(ops) },
    () => { /* ack callback – no-op for MVP */ },
  )
}
