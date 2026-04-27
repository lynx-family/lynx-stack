// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { ComponentChild, ComponentChildren } from 'preact';
import { createElement } from 'preact';

/**
 * @internal
 */
export function __etSlot(id: number, children: ComponentChildren): ComponentChild {
  if (__BACKGROUND__) {
    return createElement('slot', { id }, children);
  }
  throw new Error(
    '__etSlot() should not run on the main thread. LEPUS ET children are lowered to slot arrays at compile time.',
  );
}
