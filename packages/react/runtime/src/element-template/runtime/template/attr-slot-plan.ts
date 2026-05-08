// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { SerializableValue } from '../../protocol/types.js';

export type EtAttrAdapter = (
  handleId: number,
  attrSlotIndex: number,
  value: unknown,
) => SerializableValue | null;

export type EtAttrPlan = Array<number | EtAttrAdapter>;

export type EtAttrPlanMap = Record<
  string,
  EtAttrPlan | undefined
>;

export const __etAttrPlanMap = Object.create(null) as EtAttrPlanMap;

export function clearEtAttrPlanMap(): void {
  // The compiled output assigns into the exported side table directly, so the
  // object identity must stay stable when tests or teardown clear state.
  for (const templateKey in __etAttrPlanMap) {
    delete __etAttrPlanMap[templateKey];
  }
}
