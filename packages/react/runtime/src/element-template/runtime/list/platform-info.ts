// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { ETListItemPlatformInfo } from './list.js';

// 与 Snapshot 的 platformInfoAttributes 保持相同的原生字段白名单。
const platformInfoKeys = [
  'reuse-identifier',
  'full-span',
  'item-key',
  'sticky-top',
  'sticky-bottom',
  'estimated-height',
  'estimated-height-px',
  'estimated-main-axis-size-px',
  'recyclable',
] as const;

// spread 可能混入普通属性；显式平台信息也统一经过此白名单，不做属性名转换。
export function filterListItemPlatformInfoFromSpread(
  info: ETListItemPlatformInfo,
): ETListItemPlatformInfo {
  const result: ETListItemPlatformInfo = {};
  for (const key of platformInfoKeys) {
    if (Object.prototype.hasOwnProperty.call(info, key)) {
      result[key] = info[key]!;
    }
  }
  return result;
}
