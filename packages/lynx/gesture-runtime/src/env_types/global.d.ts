// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

declare class FiberElement {}

declare function __SetGestureDetector(
  node: FiberElement,
  id: number,
  type: number,
  config: Record<string, unknown>,
  relationMap: Record<string, number[]>,
): void;
declare function __RemoveGestureDetector(node: FiberElement, id: number): void;

declare function __FlushElementTree(element?: FiberElement): void;

declare global {
  var runWorklet: (worklet: unknown, data: unknown) => void;
}

// Internal augmentation - not exported to users
declare module '@lynx-js/types' {
  // biome-ignore lint/style/noNamespace: Augmenting external namespace
  namespace MainThread {
    interface Element {
      element: FiberElement;
    }
  }
}
