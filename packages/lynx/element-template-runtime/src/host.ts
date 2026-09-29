// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { ElementTemplateSerializableValue } from './protocol.js';

export interface ElementTemplateHost<
  AttributeSlot = ElementTemplateSerializableValue,
  SlotChild = unknown,
  ListItemPlatformInfo = unknown,
> {
  plain?: true | undefined;
  type: string;
  templateKey: string;
  bundleUrl: string;
  key: unknown;
  attributeSlots: AttributeSlot[] | undefined;
  slotChildren: SlotChild[] | undefined;
  __listItemPlatformInfo?: ListItemPlatformInfo | undefined;
  props?: {
    attributeSlots: AttributeSlot[] | undefined;
    children: SlotChild[] | undefined;
  };
}

export interface CreateElementTemplateHostOptions {
  includeDebugProps?: boolean | undefined;
}

export function createElementTemplateHost<
  AttributeSlot = ElementTemplateSerializableValue,
  SlotChild = unknown,
  ListItemPlatformInfo = unknown,
>(
  type: string,
  templateKey: string,
  bundleUrl: string,
  key: unknown,
  attributeSlots: AttributeSlot[] | undefined,
  slotChildren: SlotChild[] | undefined,
  listItemPlatformInfo: ListItemPlatformInfo | undefined,
  plain?: true,
  options?: CreateElementTemplateHostOptions,
): ElementTemplateHost<AttributeSlot, SlotChild, ListItemPlatformInfo> {
  const host: ElementTemplateHost<
    AttributeSlot,
    SlotChild,
    ListItemPlatformInfo
  > = {
    type,
    templateKey,
    bundleUrl,
    key,
    attributeSlots,
    slotChildren,
    __listItemPlatformInfo: listItemPlatformInfo,
    plain,
  };

  if (options?.includeDebugProps === true) {
    host.props = { attributeSlots, children: slotChildren };
  }

  return host;
}

export function isElementTemplateHost<
  AttributeSlot = ElementTemplateSerializableValue,
  SlotChild = unknown,
  ListItemPlatformInfo = unknown,
>(
  value: unknown,
): value is ElementTemplateHost<
  AttributeSlot,
  SlotChild,
  ListItemPlatformInfo
> {
  return typeof value === 'object'
    && value !== null
    && 'type' in value
    && typeof value.type === 'string'
    && 'templateKey' in value
    && typeof value.templateKey === 'string';
}
