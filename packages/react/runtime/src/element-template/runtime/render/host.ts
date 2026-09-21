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
  const host: ElementTemplateHost = {
    type,
    templateKey,
    bundleUrl,
    key,
    attributeSlots,
    slotChildren,
    __listItemPlatformInfo,
  };
  if (__DEV__) {
    // Preact debug formats host props in diagnostics such as duplicate keys.
    // The renderer consumes the compact fields in both development and production.
    host.props = { attributeSlots, children: slotChildren };
  }
  return host;
}

/** The compiler proves that this host needs no attribute adapters or list item setup. */
export function __etPlainHost(
  type: string,
  templateKey: string,
  bundleUrl: string,
  key: unknown,
  attributeSlots: SerializableValue[] | undefined,
  slotChildren: unknown[] | undefined,
): ElementTemplateHost {
  const host: ElementTemplateHost = { type, templateKey, bundleUrl, key, attributeSlots, slotChildren, plain: true };
  if (__DEV__) {
    host.props = { attributeSlots, children: slotChildren };
  }
  return host;
}

export interface ElementTemplateHost {
  plain?: true;
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
