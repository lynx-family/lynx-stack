// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { MainThread } from '@lynx-js/types';

export function isMainThreadElement(ele: unknown): ele is MainThread.Element {
  'main thread';
  // @ts-expect-error error
  // biome-ignore lint/complexity/useOptionalChain: <explanation>
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  if (ele && ele.element && ele.element.elementRefptr) {
    return true;
  } else {
    return false;
  }
}

export function isMainThreadElementArray(
  eleArr: unknown,
): eleArr is MainThread.Element[] {
  'main thread';
  return Array.isArray(eleArr) && eleArr.every(ele => isMainThreadElement(ele));
}
