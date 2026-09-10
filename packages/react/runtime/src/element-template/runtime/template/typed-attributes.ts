// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { adaptSpreadAttrSlot } from './attr-slot-plan.js';
import type { EtAttrPlan } from './attr-slot-plan.js';
import type { RuntimeTypedElementAttributes, TypedElementAttributesCommand } from '../../protocol/types.js';

export const TYPED_ELEMENT_ATTRIBUTES_SLOT_INDEX = 0;

export const TYPED_ELEMENT_ATTR_PLAN: EtAttrPlan = [
  TYPED_ELEMENT_ATTRIBUTES_SLOT_INDEX,
  adaptSpreadAttrSlot,
];

export function prepareTypedElementAttributes(
  handleId: number,
  attributes: RuntimeTypedElementAttributes | null | undefined,
): TypedElementAttributesCommand | null {
  return adaptSpreadAttrSlot(
    handleId,
    TYPED_ELEMENT_ATTRIBUTES_SLOT_INDEX,
    attributes,
  ) as TypedElementAttributesCommand | null;
}
