// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { afterEach, describe, expect, test } from '@rstest/core';

import { applyA2UIMessagesToSnapshot } from './conversationSnapshot.js';

const POLLUTED_KEY = '__genui_polluted__';
const objectPrototype = Object.prototype as Record<string, unknown>;

afterEach(() => {
  delete objectPrototype[POLLUTED_KEY];
});

describe('conversation data model snapshot', () => {
  test('stores __proto__ path segments without polluting Object.prototype', () => {
    const dataModel: Record<string, unknown> = {};
    const surfaceIds = new Set<string>();

    applyA2UIMessagesToSnapshot(dataModel, surfaceIds, [
      { createSurface: { surfaceId: 'main' } },
      {
        updateDataModel: {
          surfaceId: 'main',
          path: `/__proto__/${POLLUTED_KEY}`,
          value: 'nested',
        },
      },
    ]);

    expect(surfaceIds).toEqual(new Set(['main']));
    expect(Object.getPrototypeOf(dataModel)).toBe(Object.prototype);
    expect(objectPrototype[POLLUTED_KEY]).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(dataModel, '__proto__')).toBe(
      true,
    );
    expect(
      (Reflect.get(dataModel, '__proto__') as Record<string, unknown>)[
        POLLUTED_KEY
      ],
    ).toBe('nested');
  });

  test('replaces the root without invoking the __proto__ setter', () => {
    const dataModel: Record<string, unknown> = { stale: true };
    const rootValue = JSON.parse(
      `{"__proto__":{"${POLLUTED_KEY}":"root"},"safe":true}`,
    ) as Record<string, unknown>;

    applyA2UIMessagesToSnapshot(dataModel, new Set(), [
      { updateDataModel: { path: '/', value: rootValue } },
    ]);

    expect(dataModel.stale).toBeUndefined();
    expect(dataModel.safe).toBe(true);
    expect(Object.getPrototypeOf(dataModel)).toBe(Object.prototype);
    expect(objectPrototype[POLLUTED_KEY]).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(dataModel, '__proto__')).toBe(
      true,
    );
    expect(
      (Reflect.get(dataModel, '__proto__') as Record<string, unknown>)[
        POLLUTED_KEY
      ],
    ).toBe('root');
  });

  test('does not retain prototype references from non-JSON values', () => {
    const dataModel: Record<string, unknown> = {};
    const cyclicValue: Record<string, unknown> = {
      target: Object.prototype,
    };
    cyclicValue.self = cyclicValue;

    applyA2UIMessagesToSnapshot(dataModel, new Set(), [
      { updateDataModel: { path: '/holder', value: cyclicValue } },
      {
        updateDataModel: {
          path: `/holder/target/${POLLUTED_KEY}`,
          value: 'local',
        },
      },
    ]);

    expect(objectPrototype[POLLUTED_KEY]).toBeUndefined();
    const holder = dataModel.holder as Record<string, unknown>;
    const target = holder.target as Record<string, unknown>;
    expect(target[POLLUTED_KEY]).toBe('local');
  });

  test('updates an array length without redefining its attributes', () => {
    const dataModel: Record<string, unknown> = {};

    applyA2UIMessagesToSnapshot(dataModel, new Set(), [
      { updateDataModel: { path: '/items', value: ['a', 'b'] } },
      { updateDataModel: { path: '/items/length', value: 1 } },
    ]);

    expect(dataModel.items).toEqual(['a']);
  });

  test('updates and deletes ordinary nested values', () => {
    const dataModel: Record<string, unknown> = {};

    applyA2UIMessagesToSnapshot(dataModel, new Set(), [
      { updateDataModel: { path: '/profile/name', value: 'Ada' } },
    ]);
    expect(dataModel).toEqual({ profile: { name: 'Ada' } });

    applyA2UIMessagesToSnapshot(dataModel, new Set(), [
      { updateDataModel: { path: '/profile/name', value: undefined } },
    ]);
    expect(dataModel).toEqual({ profile: {} });
  });
});
