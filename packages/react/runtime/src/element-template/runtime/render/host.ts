// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { SerializableValue } from '../../protocol/types.js';
import type { ETListItemPlatformInfo } from '../list/list.js';

/** Compiler-owned first-screen data. Construction does not create native nodes. */
export function __etHost(
  type: string,
  templateKey: string,
  bundleUrl: string,
  key: unknown,
  attributeSlots: SerializableValue[] | undefined,
  slotChildren: unknown[] | undefined,
  __listItemPlatformInfo: ETListItemPlatformInfo | undefined,
): ElementTemplateHost {
  return { type, templateKey, bundleUrl, key, attributeSlots, slotChildren, __listItemPlatformInfo };
}

export interface ElementTemplateHost {
  type: string;
  templateKey: string;
  bundleUrl: string;
  key: unknown;
  attributeSlots: SerializableValue[] | undefined;
  slotChildren: unknown[] | undefined;
  __listItemPlatformInfo: ETListItemPlatformInfo | undefined;
}
