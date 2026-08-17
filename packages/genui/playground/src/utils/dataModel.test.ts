// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core';

import { applyDataModel, cloneDataModel } from './dataModel.js';

describe('safe data model updates', () => {
  test('applies ordinary nested updates', () => {
    const model: Record<string, unknown> = {};
    applyDataModel(model, '/profile/name', 'Lynx');
    expect(model).toEqual({ profile: { name: 'Lynx' } });
  });

  test('rejects prototype-polluting update paths', () => {
    const model: Record<string, unknown> = {};
    applyDataModel(model, '/__proto__/polluted', true);
    applyDataModel(model, '/constructor/prototype/polluted', true);
    expect(model).toEqual({});
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
  });

  test('removes unsafe keys from replacement values and snapshots', () => {
    const value = JSON.parse(
      '{"safe":{"value":1},"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}}}',
    ) as Record<string, unknown>;
    const model: Record<string, unknown> = {};

    applyDataModel(model, '/', value);

    expect(model).toEqual({ safe: { value: 1 } });
    expect(cloneDataModel(value)).toEqual({ safe: { value: 1 } });
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
  });
});
