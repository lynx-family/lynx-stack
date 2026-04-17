// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ElementTemplateRegistry,
  setElementTemplateNativeRef,
} from '../../../../src/element-template/runtime/template/registry.js';
import {
  createElementTemplateWithHandle,
  destroyElementTemplateId,
  reserveElementTemplateId,
} from '../../../../src/element-template/runtime/template/handle.js';
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
    ElementTemplateRegistry.clear();
    resetTemplateId();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should reserve and bind a handle separately', () => {
    const id = reserveElementTemplateId();

    expect(id).toBe(-1);
    expect(ElementTemplateRegistry.has(id)).toBe(false);

    setElementTemplateNativeRef(id, mockNativeRef as any);

    expect(ElementTemplateRegistry.get(id)).toBe(mockNativeRef);
  });

  it('should create an element template with handle id and register the native ref', () => {
    const nativeRef = createElementTemplateWithHandle(
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
    expect(ElementTemplateRegistry.get(-1)).toBe(mockCreatedNativeRef);
  });

  it('should allocate monotonically decreasing handle ids for template creation', () => {
    createElementTemplateWithHandle('_et_first', null, null, null);
    createElementTemplateWithHandle('_et_second', null, null, null);

    expect(mockCreateElementTemplate.mock.calls[0]?.[4]).toEqual(-1);
    expect(mockCreateElementTemplate.mock.calls[1]?.[4]).toEqual(-2);
    expect(ElementTemplateRegistry.get(-1)).toBe(mockCreatedNativeRef);
    expect(ElementTemplateRegistry.get(-2)).toBe(mockCreatedNativeRef);
  });

  it('should destroy and unregister a handle', () => {
    const id = reserveElementTemplateId();
    setElementTemplateNativeRef(id, mockNativeRef as any);

    expect(ElementTemplateRegistry.has(id)).toBe(true);

    destroyElementTemplateId(id);

    expect(ElementTemplateRegistry.has(id)).toBe(false);
    // expect(mockReleaseElement).toHaveBeenCalledWith(mockNativeRef);
  });
});
