// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export const ELEMENT_TEMPLATE_PROTOCOL_VERSION = 1;

export const ElementTemplateUpdateOps = {
  createTemplate: 1,
  setAttribute: 2,
  insertNode: 3,
  removeNode: 4,
  createTypedElement: 5,
  insertTypedListItem: 6,
  removeTypedListItem: 7,
  updateTypedListItem: 8,
  setMainThreadEvent: 9,
  setMainThreadRef: 10,
} as const;

export type ElementTemplateUpdateOp =
  typeof ElementTemplateUpdateOps[keyof typeof ElementTemplateUpdateOps];

export const BUILTIN_RAW_TEXT_TEMPLATE_KEY = '_et_builtin_raw_text';
export const MAIN_BUNDLE_URL_SENTINEL = '__Card__';

export const ELEMENT_TEMPLATE_SPREAD_ATTRIBUTE_SLOT_INDEX = 0;

export const ELEMENT_TEMPLATE_EVENT_ATTRIBUTE_NAMES: readonly string[] = [
  'bindtap',
  'catchtap',
  'capture-bindtap',
  'capture-catchtap',
  'global-bindtap',
  'bindlongtap',
  'catchlongtap',
  'bindlongpress',
  'catchlongpress',
  'bindtouchstart',
  'catchtouchstart',
  'capture-bindtouchstart',
  'capture-catchtouchstart',
  'global-bindtouchstart',
  'bindtouchmove',
  'catchtouchmove',
  'capture-bindtouchmove',
  'capture-catchtouchmove',
  'global-bindtouchmove',
  'bindtouchend',
  'catchtouchend',
  'capture-bindtouchend',
  'capture-catchtouchend',
  'global-bindtouchend',
  'bindtouchcancel',
  'catchtouchcancel',
  'capture-bindtouchcancel',
  'capture-catchtouchcancel',
  'global-bindtouchcancel',
  'bindfocus',
  'bindblur',
  'bindinput',
  'bindchange',
  'bindconfirm',
  'bindselection',
  'bindkeydown',
  'bindkeyup',
  'bindscroll',
  'bindscrollstart',
  'bindscrollend',
  'bindscrolltoupper',
  'bindscrolltolower',
  'bindcontentsizechanged',
  'bindload',
  'binderror',
];

const elementTemplateEventAttributeSlotIndices = new Map(
  ELEMENT_TEMPLATE_EVENT_ATTRIBUTE_NAMES.map((name, index) => [
    name,
    index + 1,
  ]),
);
const lynxEventAttributeNameRegExp =
  /^(?:global-bind|bind|catch|capture-bind|capture-catch)[A-Za-z]+$/;

export function getElementTemplateEventAttributeSlotIndex(
  name: string,
): number | undefined {
  return elementTemplateEventAttributeSlotIndices.get(name);
}

export function isLynxEventAttributeName(name: string): boolean {
  return lynxEventAttributeNameRegExp.test(name);
}

export type ElementTemplateSerializableValue =
  | string
  | number
  | boolean
  | null
  | ElementTemplateSerializableValue[]
  | { [key: string]: ElementTemplateSerializableValue };

export interface ParsedElementTemplateType {
  templateKey: string;
  bundleUrl: string | null;
}

export function parseElementTemplateType(
  type: string,
): ParsedElementTemplateType {
  const delimiter = type.lastIndexOf(':');
  if (delimiter < 0) {
    return { templateKey: type, bundleUrl: null };
  }

  const bundleUrl = type.slice(0, delimiter);
  return {
    templateKey: type.slice(delimiter + 1),
    bundleUrl: bundleUrl === MAIN_BUNDLE_URL_SENTINEL ? null : bundleUrl,
  };
}

export function elementTemplateIdentityKey(
  templateKey: string,
  bundleUrl: string | null | undefined,
): string {
  return bundleUrl == null ? templateKey : `${bundleUrl}:${templateKey}`;
}

export function elementTemplateTypeTag(
  templateKey: string,
  bundleUrl: string | null | undefined,
): string {
  return `${bundleUrl ?? MAIN_BUNDLE_URL_SENTINEL}:${templateKey}`;
}
