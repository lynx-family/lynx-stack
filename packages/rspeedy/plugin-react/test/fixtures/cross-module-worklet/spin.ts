// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// A `'main thread'` function living in its own module. Its
// `registerWorkletInternal()` call is what puts it in
// `lynxWorkletImpl._workletMap`, so this module has to reach the main-thread
// bundle even though nothing on the main thread imports it by name.
export function spin(el: unknown, deg: number): void {
  'main thread'
  ;(el as { setStyleProperty(k: string, v: string): void }).setStyleProperty(
    'transform',
    `rotate(${deg}deg)`,
  )
}
