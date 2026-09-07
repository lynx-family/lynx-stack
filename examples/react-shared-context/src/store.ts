// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// Captured at eval time on purpose: they must outlive the page that evaluated this module.
const capturedSetTimeout = setTimeout;
const CapturedPromise = Promise;

export const instanceId = `${Date.now()}-${
  Math.random().toString(36).slice(2, 7)
}`;

let count = 0;
const listeners = new Set<() => void>();

export function getCount(): number {
  return count;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function increment(): void {
  count += 1;
  listeners.forEach((listener) => listener());
}

export function incrementLater(delayMs = 1500): Promise<void> {
  return new CapturedPromise<void>((resolve) => {
    capturedSetTimeout(() => {
      increment();
      resolve();
    }, delayMs);
  });
}
