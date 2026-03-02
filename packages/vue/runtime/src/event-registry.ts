// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Sign-based event handler registry for the Background Thread.
 *
 * When patchProp registers an event handler, it gets a unique sign string.
 * The Main Thread stores this sign with __AddEvent().  When Native fires an
 * event it calls publishEvent(sign, data) on the BG Thread, which looks up
 * the handler and executes it directly – no cross-thread round-trip.
 */

let signCounter = 0
const handlers = new Map<string, (data: unknown) => void>()

export function register(handler: (data: unknown) => void): string {
  const sign = `vue:${signCounter++}`
  handlers.set(sign, handler)
  return sign
}

export function unregister(sign: string): void {
  handlers.delete(sign)
}

/** Called by Lynx Native when an event fires on BG Thread. */
export function publishEvent(sign: string, data: unknown): void {
  const handler = handlers.get(sign)
  if (handler) {
    handler(data)
  }
}
