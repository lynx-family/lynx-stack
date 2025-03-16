// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type {
  MediaQueryConfig,
  StyleEntry,
  BreakpointKey,
} from '@lynx-js/web-constants';
import { defaultBreakpoints } from '@lynx-js/web-constants';
import { boostedQueueMicrotask } from './boostedQueueMicrotask.js';

export class ResponsiveStyleManager {
  private mediaQueryLists = new Map<string, MediaQueryList>();
  private styleCallbacks = new Map<string, Set<(matches: boolean) => void>>();

  constructor() {
    this.setupMediaQueryListeners();
  }

  private setupMediaQueryListeners() {
    Object.entries(defaultBreakpoints).forEach(
      ([key, query]: [string, string]) => {
        const mediaQueryList = window.matchMedia(query);
        this.mediaQueryLists.set(key, mediaQueryList);

        const listener = (e: MediaQueryListEvent) => {
          const callbacks = this.styleCallbacks.get(key);
          if (callbacks) {
            callbacks.forEach(callback => {
              boostedQueueMicrotask(() => callback(e.matches));
            });
          }
        };

        mediaQueryList.addEventListener('change', listener);
      },
    );
  }

  subscribeToBreakpoint(
    breakpoint: BreakpointKey,
    callback: (matches: boolean) => void,
  ) {
    if (!this.styleCallbacks.has(breakpoint)) {
      this.styleCallbacks.set(breakpoint, new Set());
    }

    this.styleCallbacks.get(breakpoint)?.add(callback);
    const mediaQueryList = this.mediaQueryLists.get(breakpoint);

    if (mediaQueryList) {
      // Initial call
      callback(mediaQueryList.matches);
    }

    return () => {
      this.styleCallbacks.get(breakpoint)?.delete(callback);
    };
  }

  applyResponsiveStyles(
    element: HTMLElement,
    styles: StyleEntry[],
    mediaQuery?: MediaQueryConfig,
  ) {
    if (mediaQuery) {
      const { query, styles: mediaStyles } = mediaQuery;
      const mediaQueryList = window.matchMedia(query);

      const applyStyles = (matches: boolean) => {
        if (matches) {
          mediaStyles.forEach(([prop, value]: [string, string]) => {
            element.style.setProperty(prop, value);
          });
        } else {
          mediaStyles.forEach(([prop]: [string]) => {
            element.style.removeProperty(prop);
          });
        }
      };

      // Initial application
      applyStyles(mediaQueryList.matches);

      // Subscribe to changes
      const listener = (e: MediaQueryListEvent) => {
        boostedQueueMicrotask(() => applyStyles(e.matches));
      };

      mediaQueryList.addEventListener('change', listener);
      return () => mediaQueryList.removeEventListener('change', listener);
    } else {
      // Apply base styles
      styles.forEach(([prop, value]) => {
        element.style.setProperty(prop, value);
      });
      return () => {
        styles.forEach(([prop]) => {
          element.style.removeProperty(prop);
        });
      };
    }
  }

  dispose() {
    this.styleCallbacks.clear();
    this.mediaQueryLists.clear();
  }
}
