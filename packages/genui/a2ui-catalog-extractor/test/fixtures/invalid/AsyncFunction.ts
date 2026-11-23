// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Automatic schema extraction does not support async functions.
 *
 * @a2uiFunction asyncWork
 */
export function asyncWork(args: { value: string }): Promise<string> {
  return Promise.resolve(args.value);
}
