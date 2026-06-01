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
    const circular: Record<string, unknown> = {};
    circular['self'] = circular;
    const jsonUndefined = { toJSON: () => undefined };
    function namedHandler() {}
    const anonymousHandler = () => {};
    Object.defineProperty(anonymousHandler, 'name', { value: '' });

    const target = {
      __CreateElementTemplate: vi.fn(() => templateRef),
      __CreateTypedElementTemplate: vi.fn(() => typedRef),
      __SetAttributeOfElementTemplate: vi.fn(),
      __InsertNodeToElementTemplate: vi.fn(() => childRef),
      __RemoveNodeFromElementTemplate: vi.fn(() => null),
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
      '0',
      null,
    )).toBe(typedRef);
    (target.__SetAttributeOfElementTemplate as (...args: unknown[]) => unknown)(
      templateRef,
      0,
      [
        templateRef,
        undefined,
        null,
        namedHandler,
        anonymousHandler,
        Symbol.for('slot'),
        circular,
        jsonUndefined,
      ],
      null,
    );
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
    expect((target.__SerializeElementTemplate as (...args: unknown[]) => unknown)(templateRef)).toBe(
      Symbol.for('serialized'),
    );

    const logs = (console.alog as unknown as { mock: { calls: unknown[][] } }).mock.calls
      .map(args => String(args[0]))
      .join('\n');
    expect(logs).toContain(
      '__CreateElementTemplate("_et_card", null, ["title"], [], 17) => _et_card#17',
    );
    expect(logs).toContain('__CreateTypedElementTemplate("page", null, null, "0", null) => page#0');
    expect(logs).toContain(
      '__SetAttributeOfElementTemplate(_et_card#17, 0, [_et_card#17, undefined, null, [Function namedHandler], [Function], Symbol(slot), [object Object], [object Object]], null)',
    );
    expect(logs).toContain(
      '__InsertNodeToElementTemplate(_et_card#17, 1, {"id":2}, undefined) => {"id":2}',
    );
    expect(logs).toContain('__RemoveNodeFromElementTemplate(_et_card#17, 1, {"id":2})');
    expect(logs).toContain('__SerializeElementTemplate(_et_card#17) => Symbol(serialized)');
    expect(globalThis.lynx.performance.profileStart).toHaveBeenCalledTimes(6);
    expect(globalThis.lynx.performance.profileEnd).toHaveBeenCalledTimes(6);
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
