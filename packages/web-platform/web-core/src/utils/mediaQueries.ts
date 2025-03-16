// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export function applyMediaQuery(
  query: string,
  callback: (matches: boolean) => void,
): () => void {
  const mediaQuery = window.matchMedia(query);
  const listener = (e: MediaQueryListEvent) => callback(e.matches);

  mediaQuery.addEventListener('change', listener);
  callback(mediaQuery.matches); // Initial call

  return () => mediaQuery.removeEventListener('change', listener);
}

export function createMediaQueryManager() {
  const listeners = new Map<string, Set<(matches: boolean) => void>>();

  return {
    subscribe(query: string, callback: (matches: boolean) => void) {
      if (!listeners.has(query)) {
        listeners.set(query, new Set());
      }
      listeners.get(query)?.add(callback);
      return applyMediaQuery(query, (matches) => {
        listeners.get(query)?.forEach(cb => cb(matches));
      });
    },

    unsubscribe(query: string, callback: (matches: boolean) => void) {
      listeners.get(query)?.delete(callback);
      if (listeners.get(query)?.size === 0) {
        listeners.delete(query);
      }
    },
  };
}
