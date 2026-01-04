// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export function convertLengthToPx(
  targetElement: HTMLElement,
  str: string | null,
  isWidth?: boolean,
): number {
  if (str) {
    str = str.trim();
    if (str.endsWith('px')) {
      return Number(str.substring(0, str.length - 2));
    } else if (str.endsWith('%')) {
      const pct = Number(str.substring(0, str.length - 1));
      const { width, height } = targetElement.getBoundingClientRect();
      const base = isWidth ? width : height;
      return (base * pct) / 100;
    } else {
      /**
       * TODO (haoyang.wang): support rpx
       */
      return 0;
    }
  }
  return 0;
}
