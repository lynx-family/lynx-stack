// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { MainThread } from '@lynx-js/types';

declare function __GetComputedStyleByKey(element: unknown, key: string): string;

// Read the same engine style state on native and Web, without browser DOM APIs.
export function readStyle(element: MainThread.Element, key: string): string {
  return __GetComputedStyleByKey(
    (element as unknown as { element: unknown }).element,
    key,
  );
}
