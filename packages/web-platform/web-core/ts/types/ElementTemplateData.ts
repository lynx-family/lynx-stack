/*
 * Copyright 2023 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */

export type ElementTemplateStaticAttribute = {
  kind: 'static';
  key: string;
  value: string | number | boolean | null;
};

export type ElementTemplateSlotAttribute = {
  kind: 'slot';
  key: string;
  attrSlotIndex: number;
};

export type ElementTemplateSpreadAttribute = {
  kind: 'spread';
  attrSlotIndex: number;
};

export type ElementTemplateAttribute =
  | ElementTemplateStaticAttribute
  | ElementTemplateSlotAttribute
  | ElementTemplateSpreadAttribute;

export type ElementTemplateElementNode = {
  kind: 'element';
  type: string;
  attributesArray?: ElementTemplateAttribute[];
  children?: ElementTemplateNode[];
};

export type ElementTemplateSlotNode = {
  kind: 'elementSlot';
  type: 'slot';
  elementSlotIndex: number;
};

export type ElementTemplateNode =
  | ElementTemplateElementNode
  | ElementTemplateSlotNode;

export type ElementTemplateData = ElementTemplateElementNode;

export type ElementTemplateAsset = {
  templateId: string;
  compiledTemplate: ElementTemplateData;
  sourceFile?: string;
};

export type ElementTemplateRecord = Record<string, ElementTemplateData>;

export type ElementTemplateBundle = ElementTemplateAsset[];

export type ElementTemplateInput =
  | ElementTemplateBundle
  | ElementTemplateRecord;
