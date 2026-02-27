// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export function bindToIntersectionObserver(
  rootGetter: () => HTMLElement,
  targetGetter: () => HTMLElement,
  callback: IntersectionObserverCallback,
) {
  let observer: IntersectionObserver | undefined;
  return (newVal: string | boolean | null) => {
    if (newVal !== null) {
      if (!observer) {
        observer = new IntersectionObserver(callback, {
          root: rootGetter(),
        });
        observer.observe(targetGetter());
      }
    } else {
      if (observer) {
        observer.disconnect();
        observer = undefined;
      }
    }
  };
}
