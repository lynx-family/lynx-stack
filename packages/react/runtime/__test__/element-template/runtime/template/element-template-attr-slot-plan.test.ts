import { afterEach, describe, expect, it } from 'vitest';

import { prepareAttributeSlots } from '../../../../src/element-template/background/attr-slots.js';
import {
  __etAttrPlanMap,
  adaptRefAttrSlot,
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

  it('prepares direct ref slots as native ref markers', () => {
    expect(adaptRefAttrSlot(-2, 0, () => {})).toBe('-2-0');
    expect(adaptRefAttrSlot(17, 3, { current: null })).toBe('17-3');
  });

  it('normalizes empty direct ref slots to null', () => {
    expect(adaptRefAttrSlot(-2, 0, null)).toBeNull();
    expect(adaptRefAttrSlot(-2, 0, undefined)).toBeNull();
  });

  it('rejects invalid direct ref values like the Snapshot runtime', () => {
    const error = 'Elements\' "ref" property should be a function, or an object created by createRef()';

    expect(() => adaptRefAttrSlot(-2, 0, false)).toThrowError(error);
    expect(() => adaptRefAttrSlot(-2, 0, 1)).toThrowError(error);
    expect(() => adaptRefAttrSlot(-2, 0, 'ref')).toThrowError(error);
    expect(() => adaptRefAttrSlot(-2, 0, {})).toThrowError(error);
  });

  it('prepares registered ref attr slots through the attr plan consumer', () => {
    __etAttrPlanMap._et_ref = [0, adaptRefAttrSlot];

    expect(prepareAttributeSlots('_et_ref', -2, [() => {}], false)).toEqual(['-2-0']);
    expect(() => prepareAttributeSlots('_et_ref', -2, [1], false)).toThrowError(
      'Elements\' "ref" property should be a function, or an object created by createRef()',
    );
  });
});
