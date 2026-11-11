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
  // Set only when the compiler proves no attribute adapters or list-item setup are needed.
  plain?: true,
): ElementTemplateHost {
  const host: ElementTemplateHost = {
    type,
    templateKey,
    bundleUrl,
    key,
    attributeSlots,
    slotChildren,
    __listItemPlatformInfo,
    plain,
  };
  if (__DEV__) {
    // Preact debug formats host props in diagnostics such as duplicate keys.
    // The renderer consumes the compact fields in both development and production.
    host.props = { attributeSlots, children: slotChildren };
  }
  return host;
}

export interface ElementTemplateHost {
  plain?: true | undefined;
  type: string;
  templateKey: string;
  bundleUrl: string;
  key: unknown;
  attributeSlots: SerializableValue[] | undefined;
  slotChildren: unknown[] | undefined;
  __listItemPlatformInfo?: ETListItemPlatformInfo | undefined;
  props?: {
    attributeSlots: SerializableValue[] | undefined;
    children: unknown[] | undefined;
  };
}
