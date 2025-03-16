// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { ResponsiveStyle } from '@lynx-js/web-constants';
import { ResponsiveStyleManager } from '../mediaQueries.js';

const responsiveManager = new ResponsiveStyleManager();

export function responsive(styles: ResponsiveStyle) {
  return function(target: typeof HTMLElement) {
    const connectedCallback = target.prototype.connectedCallback;
    const disconnectedCallback = target.prototype.disconnectedCallback;

    let cleanup: (() => void) | undefined;

    target.prototype.connectedCallback = function(this: HTMLElement) {
      if (connectedCallback) {
        connectedCallback.call(this);
      }

      // Apply base styles
      const baseCleanup = responsiveManager.applyResponsiveStyles(
        this,
        styles.base,
      );

      // Apply media query styles
      const mediaCleanups = styles.mediaQueries.map(mediaQuery =>
        responsiveManager.applyResponsiveStyles(this, [], mediaQuery)
      );

      cleanup = () => {
        baseCleanup();
        mediaCleanups.forEach(cleanupFn => cleanupFn());
      };
    };

    target.prototype.disconnectedCallback = function() {
      if (disconnectedCallback) {
        disconnectedCallback.call(this);
      }
      if (cleanup) {
        cleanup();
        cleanup = undefined;
      }
    };

    return target;
  };
}
