import { afterEach, describe, expect, it } from 'vitest';

import {
  __etAttrPlanMap,
  clearEtAttrPlanMap,
  type EtAttrAdapter,
} from '../../../../src/element-template/runtime/template/attr-slot-plan.js';

describe('ElementTemplate attr slot plan registry', () => {
  afterEach(() => {
    clearEtAttrPlanMap();
  });

  it('uses undefined as the unregistered template fast path', () => {
    expect(__etAttrPlanMap._et_without_backend_attrs).toBeUndefined();
  });

  it('keeps the map object stable when clearing test state', () => {
    const map = __etAttrPlanMap;
    const adaptSlot: EtAttrAdapter = (_, __, value) => String(value);

    __etAttrPlanMap._et_card = [0, adaptSlot];
    clearEtAttrPlanMap();

    expect(__etAttrPlanMap).toBe(map);
    expect(__etAttrPlanMap._et_card).toBeUndefined();
  });
});
