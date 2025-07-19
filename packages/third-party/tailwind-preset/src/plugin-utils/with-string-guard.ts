// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
export function withStringGuard<T>(
  fn: (value: string) => T | null,
): (value: unknown) => T | null {
  return (value: unknown) => (typeof value === 'string' ? fn(value) : null);
}
