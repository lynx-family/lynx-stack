// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// Type-only `assertType` helper — the `*.test-d.{ts,tsx}` files are
// checked by `tsc --noEmit` (`test:type`), not executed.
export function assertType<T>(_value: T): void {
  // type-only assertion
}
