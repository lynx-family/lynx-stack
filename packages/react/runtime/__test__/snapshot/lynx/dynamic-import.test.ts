// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

/* global lynx, lynxCoreInject, _ReportError */

function restoreProperty(target, key, value) {
  if (value === undefined) {
    delete target[key];
    return;
  }

  target[key] = value;
}

describe('dynamic import helpers', () => {
  let originalQueryComponent;
  let originalRequireModuleAsync;
  let originalGetDynamicComponentExports;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('__LEPUS__', false);
    vi.stubGlobal('__JS__', true);
    originalQueryComponent = lynx.QueryComponent;
    originalRequireModuleAsync = lynx.requireModuleAsync;
    originalGetDynamicComponentExports = lynxCoreInject.tt.getDynamicComponentExports;
  });

  afterEach(() => {
    restoreProperty(lynx, 'QueryComponent', originalQueryComponent);
    restoreProperty(lynx, 'requireModuleAsync', originalRequireModuleAsync);
    restoreProperty(
      lynxCoreInject.tt,
      'getDynamicComponentExports',
      originalGetDynamicComponentExports,
    );
  });

  test('loads plain dynamic JS through requireModuleAsync', async () => {
    const requireModuleAsync = vi.fn((url, callback) => {
      callback(null, { data: url });
    });
    lynx.requireModuleAsync = requireModuleAsync;

    const { loadDynamicJS, __dynamicImport } = await import(
      '../../../src/core/lynx/dynamic-import.js'
    );

    await expect(loadDynamicJS('plain-entry')).resolves.toEqual({
      data: 'plain-entry',
    });
    await expect(__dynamicImport('plain-dynamic')).resolves.toEqual({
      data: 'plain-dynamic',
    });
    expect(requireModuleAsync).toHaveBeenCalledWith('plain-entry', expect.any(Function));
    expect(requireModuleAsync).toHaveBeenCalledWith('plain-dynamic', expect.any(Function));
  });

  test('rejects plain dynamic JS when requireModuleAsync fails', async () => {
    const error = new Error('load failed');
    const requireModuleAsync = vi.fn((_url, callback) => {
      callback(error);
    });
    lynx.requireModuleAsync = requireModuleAsync;

    const { loadDynamicJS } = await import(
      '../../../src/core/lynx/dynamic-import.js'
    );

    await expect(loadDynamicJS('failed-entry')).rejects.toBe(error);
    expect(requireModuleAsync).toHaveBeenCalledWith('failed-entry', expect.any(Function));
  });

  test('loads component dynamic imports through loadLazyBundle', async () => {
    const QueryComponent = vi.fn((source, callback) => {
      callback({ code: 0, detail: { schema: source } });
    });
    const getDynamicComponentExports = vi.fn(schema => ({
      default: () => null,
      data: schema,
    }));
    lynx.QueryComponent = QueryComponent;
    lynxCoreInject.tt.getDynamicComponentExports = getDynamicComponentExports;

    const { __dynamicImport } = await import(
      '../../../src/core/lynx/dynamic-import.js'
    );

    await expect(
      __dynamicImport('component-entry', { with: { type: 'component' } }),
    ).resolves.toMatchObject({ data: 'component-entry' });
    expect(QueryComponent).toHaveBeenCalledWith('component-entry', expect.any(Function));
    expect(getDynamicComponentExports).toHaveBeenCalledWith('component-entry');
  });

  test('reports leaked plain dynamic imports on the main thread', async () => {
    vi.stubGlobal('__LEPUS__', true);

    const { loadDynamicJS } = await import(
      '../../../src/core/lynx/dynamic-import.js'
    );

    await expect(loadDynamicJS('leaked-entry')).rejects.toBeUndefined();
    expect(_ReportError).toHaveBeenCalledWith(
      expect.any(Error),
      { errorCode: 202 },
    );
  });
});
