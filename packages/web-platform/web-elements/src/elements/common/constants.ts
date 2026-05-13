// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

const isWebKit = /\bAppleWebKit\b/.test(navigator.userAgent)
  && !/\b(?:Chrome|Chromium|CriOS|Edg)\b/.test(navigator.userAgent);

// WebKit exposes scrollend in some environments, but it is not reliable for
// programmatic scrolls. Use the debounce fallback there.
export const useScrollEnd = 'onscrollend' in document && !isWebKit;

export const scrollContainerDom = Symbol.for('lynx-scroll-container-dom');
