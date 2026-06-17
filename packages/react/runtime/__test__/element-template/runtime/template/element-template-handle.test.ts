// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  elementTemplateRegistry,
  setElementTemplateNativeRef,
} from '../../../../src/element-template/runtime/template/registry.js';
import {
  __etAttrPlanMap,
  adaptMTEventAttrSlot,
  clearEtAttrPlanMap,
} from '../../../../src/element-template/runtime/template/attr-slot-plan.js';
import {
  createElementTemplateWithReservedHandle,
  destroyElementTemplateId,
  reserveElementTemplateId,
} from '../../../../src/element-template/runtime/template/handle.js';
import {
  clearMainThreadDynamicAttrState,
  getMainThreadDynamicAttrState,
} from '../../../../src/element-template/runtime/template/main-thread-dynamic-attr-state.js';
import { resetTemplateId } from '../../../../src/element-template/runtime/template/handle.js';

describe('ElementTemplateHandle', () => {
  const mockNativeRef = { __isNativeRef: true };
  const mockCreatedNativeRef = { __isTemplateRef: true };
  const mockCreateElementTemplate = vi.fn();
  // const mockReleaseElement = vi.fn();

  beforeEach(() => {
    mockCreateElementTemplate.mockReset();
    mockCreateElementTemplate.mockReturnValue(mockCreatedNativeRef);
    vi.stubGlobal('__CreateElementTemplate', mockCreateElementTemplate);
    // vi.stubGlobal('__ReleaseElement', mockReleaseElement);
    clearMainThreadDynamicAttrState();
    clearEtAttrPlanMap();
    elementTemplateRegistry.clear();
    resetTemplateId();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should reserve and bind a handle separately', () => {
    const id = reserveElementTemplateId();

    expect(id).toBe(-1);
    expect(elementTemplateRegistry.has(id)).toBe(false);

    setElementTemplateNativeRef(id, mockNativeRef as any);

    expect(elementTemplateRegistry.get(id)).toBe(mockNativeRef);
  });

  it('should create an element template with a reserved handle id and register the native ref', () => {
    const id = reserveElementTemplateId();
    const nativeRef = createElementTemplateWithReservedHandle(
      id,
      '_et_test',
      null,
      ['text'],
      null,
    );

    expect(nativeRef).toBe(mockCreatedNativeRef);
    expect(mockCreateElementTemplate).toHaveBeenCalledWith(
      '_et_test',
      null,
      ['text'],
      null,
      -1,
    );
    expect(elementTemplateRegistry.get(-1)).toBe(mockCreatedNativeRef);
  });

  it('records main-thread dynamic attr state after reserved-handle create succeeds', () => {
    const id = reserveElementTemplateId();
    const ctx = { _wkltId: 'tap' };
    __etAttrPlanMap._et_test = [0, adaptMTEventAttrSlot];
    createElementTemplateWithReservedHandle(
      id,
      '_et_test',
      null,
      [{ type: 'worklet', value: ctx }],
      null,
    );

    expect(getMainThreadDynamicAttrState(-1, 0)).toEqual({
      kind: 'mt-event',
      nativeHeldValue: ctx,
    });
  });

  it('records dynamic-entry main-thread dynamic attr state with the full template identity', () => {
    const id = reserveElementTemplateId();
    const ctx = { _wkltId: 'tap' };
    __etAttrPlanMap['lazy-entry:_et_test'] = [0, adaptMTEventAttrSlot];
    createElementTemplateWithReservedHandle(
      id,
      '_et_test',
      'lazy-entry',
      [{ type: 'worklet', value: ctx }],
      null,
    );

    expect(getMainThreadDynamicAttrState(-1, 0)).toEqual({
      kind: 'mt-event',
      nativeHeldValue: ctx,
    });
  });

  it('should allocate monotonically decreasing handle ids for template creation', () => {
    createElementTemplateWithReservedHandle(reserveElementTemplateId(), '_et_first', null, null, null);
    createElementTemplateWithReservedHandle(reserveElementTemplateId(), '_et_second', null, null, null);

    expect(mockCreateElementTemplate.mock.calls[0]?.[4]).toEqual(-1);
    expect(mockCreateElementTemplate.mock.calls[1]?.[4]).toEqual(-2);
    expect(elementTemplateRegistry.get(-1)).toBe(mockCreatedNativeRef);
    expect(elementTemplateRegistry.get(-2)).toBe(mockCreatedNativeRef);
  });

  it('should destroy and unregister a handle', () => {
    const id = reserveElementTemplateId();
    setElementTemplateNativeRef(id, mockNativeRef as any);

    expect(elementTemplateRegistry.has(id)).toBe(true);

    destroyElementTemplateId(id);

    expect(elementTemplateRegistry.has(id)).toBe(false);
    // expect(mockReleaseElement).toHaveBeenCalledWith(mockNativeRef);
  });
});
