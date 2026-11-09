// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { initElementTemplatePAPICallAlog } from '../../../src/element-template/debug/elementPAPICall.js';

describe('ElementTemplate PAPI alog wrapper', () => {
  const originalProfile = globalThis.__PROFILE__;

  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.__PROFILE__ = true;
  });

  afterEach(() => {
    globalThis.__PROFILE__ = originalProfile;
  });

  it('wraps ET PAPI calls and formats native refs', () => {
    const templateRef = { id: 1 };
    const childRef = { id: 2 };
    const typedRef = { id: 'page' };
    const circular: unknown[] = [];
    circular.push(circular);
    const toJSON = vi.fn(() => {
      throw new Error('unexpected serialization');
    });

    const target = {
      __CreateElementTemplate: vi.fn(() => templateRef),
      __CreateTypedElementTemplate: vi.fn(() => typedRef),
      __SetAttributeOfElementTemplate: vi.fn(),
      __InsertNodeToElementTemplate: vi.fn(() => childRef),
      __RemoveNodeFromElementTemplate: vi.fn(() => null),
      __FlushElementTree: vi.fn(),
      __SerializeElementTemplate: vi.fn(() => Symbol.for('serialized')),
    } satisfies Record<string, unknown>;

    initElementTemplatePAPICallAlog(target);

    expect((target.__CreateElementTemplate as (...args: unknown[]) => unknown)(
      '_et_card',
      null,
      ['title'],
      [],
      17,
    )).toBe(templateRef);
    expect((target.__CreateTypedElementTemplate as (...args: unknown[]) => unknown)(
      'page',
      null,
      null,
      0,
      null,
    )).toBe(typedRef);
    (target.__SetAttributeOfElementTemplate as (...args: unknown[]) => unknown)(
      templateRef,
      0,
      [circular, { toJSON }, 1n],
    );
    expect(toJSON).not.toHaveBeenCalled();
    expect((target.__InsertNodeToElementTemplate as (...args: unknown[]) => unknown)(
      templateRef,
      1,
      childRef,
      undefined,
    )).toBe(childRef);
    expect((target.__RemoveNodeFromElementTemplate as (...args: unknown[]) => unknown)(
      templateRef,
      1,
      childRef,
    )).toBeNull();
    (target.__FlushElementTree as (...args: unknown[]) => unknown)(undefined, { triggerLayout: true });
    expect((target.__SerializeElementTemplate as (...args: unknown[]) => unknown)(templateRef)).toBe(
      Symbol.for('serialized'),
    );

    const logs = (console.alog as unknown as { mock: { calls: unknown[][] } }).mock.calls
      .map(args => String(args[0]))
      .join('\n');
    expect(logs).toContain(
      '__CreateElementTemplate("_et_card", null, array, array, 17) => _et_card#17',
    );
    expect(logs).toContain('__CreateTypedElementTemplate("page", null, null, 0, null) => page#0');
    expect(logs).toContain(
      '__SetAttributeOfElementTemplate target=_et_card#17 slot=0 valueType=array',
    );
    expect(logs).toContain(
      '__InsertNodeToElementTemplate(_et_card#17, 1, object, undefined) => object',
    );
    expect(logs).toContain('__RemoveNodeFromElementTemplate(_et_card#17, 1, object)');
    expect(logs).toContain('__FlushElementTree(undefined, object)');
    expect(logs).toContain('__SerializeElementTemplate(_et_card#17) => symbol');
    expect(globalThis.lynx.performance.profileStart).toHaveBeenCalledTimes(7);
    expect(globalThis.lynx.performance.profileStart).toHaveBeenCalledWith(
      'ElementTemplatePAPI: __SetAttributeOfElementTemplate',
      { args: { target: '_et_card#17', slot: '0', valueType: 'array' } },
    );
    expect(globalThis.lynx.performance.profileEnd).toHaveBeenCalledTimes(7);
  });

  it('skips missing APIs and keeps logging optional', () => {
    const originalAlog = console.alog;
    const createElementTemplate = vi.fn(() => null);
    const target = {
      __CreateElementTemplate: createElementTemplate,
    } satisfies Record<string, unknown>;

    globalThis.__PROFILE__ = false;
    console.alog = undefined;
    try {
      initElementTemplatePAPICallAlog(target);

      expect((target.__CreateElementTemplate as (...args: unknown[]) => unknown)(
        '_et_empty',
        null,
        [],
        [],
        3,
      )).toBeNull();
      expect(createElementTemplate).toHaveBeenCalledTimes(1);
      expect(globalThis.lynx.performance.profileStart).not.toHaveBeenCalled();
      expect(globalThis.lynx.performance.profileEnd).not.toHaveBeenCalled();
    } finally {
      console.alog = originalAlog;
    }
  });

  it('bounds string previews and preserves the Native result when alog throws', () => {
    const originalAlog = console.alog;
    const alog = vi.fn(() => {
      throw new Error('alog failed');
    });
    console.alog = alog;
    const result = {};
    const native = vi.fn(() => result);
    const target = { __SetAttributeOfElementTemplate: native };
    try {
      initElementTemplatePAPICallAlog(target);
      const value = 'x'.repeat(1000);
      expect((target.__SetAttributeOfElementTemplate as (...args: unknown[]) => unknown)({}, 3, value)).toBe(result);
      expect(native).toHaveBeenCalledExactlyOnceWith({}, 3, value);
      expect(alog).toHaveBeenCalledExactlyOnceWith(
        `[ReactLynxDebug] ElementTemplate API call #1: __SetAttributeOfElementTemplate target=object slot=3 valueType=string preview="${
          'x'.repeat(80)
        }…"`,
      );
    } finally {
      console.alog = originalAlog;
    }
  });

  it('ends the profile when a wrapped ET PAPI throws', () => {
    const error = new Error('native failed');
    const target = {
      __CreateElementTemplate: vi.fn(() => {
        throw error;
      }),
    } satisfies Record<string, unknown>;

    initElementTemplatePAPICallAlog(target);

    expect(() =>
      (target.__CreateElementTemplate as (...args: unknown[]) => unknown)(
        '_et_error',
        null,
        [],
        [],
        5,
      )
    ).toThrow(error);
    expect(globalThis.lynx.performance.profileStart).toHaveBeenCalledTimes(1);
    expect(globalThis.lynx.performance.profileEnd).toHaveBeenCalledTimes(1);
  });
});
