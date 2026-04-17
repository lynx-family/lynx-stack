import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { setupLynxEnv } from '../../../src/element-template/lynx/env.js';
import { ElementTemplateEnvManager } from '../test-utils/debug/envManager.js';

const envManager = new ElementTemplateEnvManager();

type GlobalWithEnv = typeof globalThis & {
  __OnLifecycleEvent?: ReturnType<typeof vi.fn>;
  NativeModules?: unknown;
  processData?: (data: unknown, processorName?: string) => unknown;
  __I18N_RESOURCE_TRANSLATION__?: unknown;
  __EXTRACT_STR__?: boolean;
  __EXTRACT_STR_IDENT_FLAG__?: string;
};

describe('setupLynxEnv', () => {
  const g = globalThis as GlobalWithEnv;
  let originalOnLifecycleEvent: typeof g.__OnLifecycleEvent;
  let originalProcessData: typeof g.processData;
  let originalNativeModules: typeof g.NativeModules;
  let originalI18n: typeof g.__I18N_RESOURCE_TRANSLATION__;
  let originalExtractStr: typeof g.__EXTRACT_STR__;
  let originalExtractStrFlag: typeof g.__EXTRACT_STR_IDENT_FLAG__;
  let originalReportError: typeof globalThis.lynx.reportError;

  beforeEach(() => {
    vi.clearAllMocks();
    originalOnLifecycleEvent = g.__OnLifecycleEvent;
    originalProcessData = g.processData;
    originalNativeModules = g.NativeModules;
    originalI18n = g.__I18N_RESOURCE_TRANSLATION__;
    originalExtractStr = g.__EXTRACT_STR__;
    originalExtractStrFlag = g.__EXTRACT_STR_IDENT_FLAG__;
    originalReportError = globalThis.lynx.reportError;
    g.__EXTRACT_STR__ = false;
    g.__EXTRACT_STR_IDENT_FLAG__ = undefined;
  });

  afterEach(() => {
    g.__OnLifecycleEvent = originalOnLifecycleEvent;

    if (originalProcessData === undefined) {
      delete g.processData;
    } else {
      g.processData = originalProcessData;
    }

    if (originalNativeModules === undefined) {
      delete g.NativeModules;
    } else {
      g.NativeModules = originalNativeModules;
    }

    if (originalI18n === undefined) {
      delete g.__I18N_RESOURCE_TRANSLATION__;
    } else {
      g.__I18N_RESOURCE_TRANSLATION__ = originalI18n;
    }

    if (originalExtractStr === undefined) {
      delete g.__EXTRACT_STR__;
    } else {
      g.__EXTRACT_STR__ = originalExtractStr;
    }

    if (originalExtractStrFlag === undefined) {
      delete g.__EXTRACT_STR_IDENT_FLAG__;
    } else {
      g.__EXTRACT_STR_IDENT_FLAG__ = originalExtractStrFlag;
    }

    globalThis.lynx.reportError = originalReportError;
  });

  it('merges initData and updateData in JS env', () => {
    envManager.resetEnv('background');
    globalThis.lynxCoreInject.tt._params = {
      initData: { answer: 41, stale: true },
      updateData: { answer: 42, fresh: true },
    };

    setupLynxEnv();

    expect(globalThis.lynx.__initData).toEqual({
      answer: 42,
      stale: true,
      fresh: true,
    });
    expect(typeof globalThis.lynx.registerDataProcessors).toBe('function');
    expect(() => globalThis.lynx.registerDataProcessors()).not.toThrow();
  });

  it('falls back to empty initData when reading params throws', () => {
    envManager.resetEnv('background');
    Object.defineProperty(globalThis.lynxCoreInject.tt, '_params', {
      configurable: true,
      get() {
        throw new Error('boom');
      },
    });

    setupLynxEnv();

    expect(globalThis.lynx.__initData).toEqual({});
  });

  it('treats missing initData and updateData params as empty objects in JS env', () => {
    envManager.resetEnv('background');
    Object.defineProperty(globalThis.lynxCoreInject.tt, '_params', {
      configurable: true,
      value: {
        initData: undefined,
        updateData: undefined,
      },
    });

    setupLynxEnv();

    expect(globalThis.lynx.__initData).toEqual({});
  });

  it('installs lepus event bridge and processData handlers', () => {
    envManager.resetEnv('main');
    g.__OnLifecycleEvent = vi.fn();

    setupLynxEnv();

    globalThis.lynx.triggerGlobalEventFromLepus?.('ready', { ok: true });
    expect(g.__OnLifecycleEvent).toHaveBeenCalledWith([
      'globalEventFromLepus',
      ['ready', { ok: true }],
    ]);
    expect('NativeModules' in g).toBe(true);
    expect(g.NativeModules).toBeUndefined();

    const defaultDataProcessor = vi.fn((data: { value: number }) => ({ doubled: data.value * 2 }));
    const namedDataProcessor = vi.fn((data: { value: number }) => ({ named: data.value }));
    globalThis.lynx.registerDataProcessors?.({
      defaultDataProcessor,
      dataProcessors: {
        named: namedDataProcessor,
      },
    });

    expect(g.processData?.({ value: 2 }, 'named')).toEqual({ named: 2 });
    expect(g.processData?.({ value: 3 })).toEqual({ doubled: 6 });
    expect(namedDataProcessor).toHaveBeenCalledTimes(1);
    expect(defaultDataProcessor).toHaveBeenCalledTimes(1);
  });

  it('reports data processor errors and returns an empty object', () => {
    envManager.resetEnv('main');
    const reportError = vi.fn();
    globalThis.lynx.reportError = reportError;

    setupLynxEnv();
    globalThis.lynx.registerDataProcessors?.({
      defaultDataProcessor() {
        throw new Error('processor failed');
      },
    });

    expect(g.processData?.({ value: 1 })).toEqual({});
    expect(reportError).toHaveBeenCalledTimes(1);
    expect(String(reportError.mock.calls[0]?.[0]?.message ?? '')).toContain('processor failed');
    reportError.mockClear();
  });

  it('injects i18n and extract flags only before the default processor executes once', () => {
    envManager.resetEnv('main');
    g.__I18N_RESOURCE_TRANSLATION__ = { hello: 'world' };
    g.__EXTRACT_STR__ = true;
    g.__EXTRACT_STR_IDENT_FLAG__ = '__extract__';

    setupLynxEnv();
    globalThis.lynx.registerDataProcessors?.({
      defaultDataProcessor: (data: { value: number }) => ({ value: data.value }),
    });

    expect(g.processData?.({ value: 1 })).toEqual({
      value: 1,
      __I18N_RESOURCE_TRANSLATION__: { hello: 'world' },
      _EXTRACT_STR: '__extract__',
    });
    expect(g.processData?.({ value: 2 })).toEqual({
      value: 2,
    });
  });

  it('falls back to raw data when named or default processors are missing', () => {
    envManager.resetEnv('main');

    setupLynxEnv();
    globalThis.lynx.registerDataProcessors?.({
      dataProcessors: {},
    });

    expect(g.processData?.({ value: 1 }, 'missing')).toEqual({ value: 1 });
    expect(g.processData?.({ value: 2 })).toEqual({ value: 2 });
  });
});
