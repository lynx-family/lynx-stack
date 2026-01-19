// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// biome-ignore lint/suspicious/noEmptyBlockStatements: <explanation>
export const noop = (): void => {};

export function noopMT(): void {
  'main thread';
}
