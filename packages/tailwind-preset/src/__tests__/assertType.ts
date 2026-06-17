// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// Replacement for vitest's `assertType` — rstest does not provide it. The
// assertion is type-only and erases to a no-op at runtime.
export function assertType<T>(_value: T): void {
  // type-only assertion
}
