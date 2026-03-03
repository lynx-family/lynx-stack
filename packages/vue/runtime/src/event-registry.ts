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

let signCounter = 0;
const handlers = new Map<string, (data: unknown) => void>();

export function register(handler: (data: unknown) => void): string {
  const sign = `vue:${signCounter++}`;
  handlers.set(sign, handler);
  return sign;
}

/**
 * Update the handler for an existing sign without changing the sign.
 * Used on re-renders: keeps the same sign registered on the Main Thread
 * while pointing it to the freshest handler closure.
 */
export function updateHandler(
  sign: string,
  handler: (data: unknown) => void,
): void {
  handlers.set(sign, handler);
}

export function unregister(sign: string): void {
  handlers.delete(sign);
}

/** Called by Lynx Native when an event fires on BG Thread. */
export function publishEvent(sign: string, data: unknown): void {
  console.info('[vue-bg] publishEvent called, sign:', sign, 'known signs:', [
    ...handlers.keys(),
  ]);
  const handler = handlers.get(sign);
  if (handler) {
    console.info('[vue-bg] handler found, invoking');
    handler(data);
  } else {
    console.info('[vue-bg] NO handler for sign:', sign);
  }
}

/** Reset all state – for testing only. */
export function resetRegistry(): void {
  signCounter = 0;
  handlers.clear();
}
