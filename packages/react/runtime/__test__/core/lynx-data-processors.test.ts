import { afterEach, beforeEach, describe, expect, it, rstest } from '@rstest/core';

import { createProcessData } from '../../src/core/lynx-data-processors.js';

const g = globalThis as typeof globalThis & {
  __I18N_RESOURCE_TRANSLATION__?: unknown;
  __EXTRACT_STR__?: boolean;
  __EXTRACT_STR_IDENT_FLAG__?: unknown;
  __PROFILE__?: boolean;
};

describe('createProcessData', () => {
  let originalI18n: typeof g.__I18N_RESOURCE_TRANSLATION__;
  let originalExtractStr: typeof g.__EXTRACT_STR__;
  let originalExtractStrIdentFlag: typeof g.__EXTRACT_STR_IDENT_FLAG__;
  let originalProfile: typeof g.__PROFILE__;
  let originalReportError: typeof lynx.reportError;

  beforeEach(() => {
    originalI18n = g.__I18N_RESOURCE_TRANSLATION__;
    originalExtractStr = g.__EXTRACT_STR__;
    originalExtractStrIdentFlag = g.__EXTRACT_STR_IDENT_FLAG__;
    originalProfile = g.__PROFILE__;
    originalReportError = lynx.reportError;

    delete g.__I18N_RESOURCE_TRANSLATION__;
    g.__EXTRACT_STR__ = false;
    delete g.__EXTRACT_STR_IDENT_FLAG__;
    g.__PROFILE__ = false;
  });

  afterEach(() => {
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

    if (originalExtractStrIdentFlag === undefined) {
      delete g.__EXTRACT_STR_IDENT_FLAG__;
    } else {
      g.__EXTRACT_STR_IDENT_FLAG__ = originalExtractStrIdentFlag;
    }

    if (originalProfile === undefined) {
      delete g.__PROFILE__;
    } else {
      g.__PROFILE__ = originalProfile;
    }

    lynx.reportError = originalReportError;
  });

  it('uses named and default processors and falls back to raw data', () => {
    const defaultDataProcessor = rstest.fn((data: { value: number }) => ({ doubled: data.value * 2 }));
    const namedDataProcessor = rstest.fn((data: { value: number }) => ({ named: data.value }));
    lynx.reportError = rstest.fn();
    const processData = createProcessData({
      defaultDataProcessor,
      dataProcessors: {
        named: namedDataProcessor,
      },
    });

    expect(processData({ value: 2 }, 'named')).toEqual({ named: 2 });
    expect(processData({ value: 3 })).toEqual({ doubled: 6 });
    expect(processData({ value: 4 }, 'missing')).toEqual({ value: 4 });
    expect(namedDataProcessor).toHaveBeenCalledTimes(1);
    expect(defaultDataProcessor).toHaveBeenCalledTimes(1);
    expect(lynx.reportError).not.toHaveBeenCalled();
  });

  it('reports processor errors and returns an empty object', () => {
    const error = new Error('processor failed');
    lynx.reportError = rstest.fn();
    const processData = createProcessData({
      defaultDataProcessor() {
        throw error;
      },
    });

    expect(processData({ value: 1 })).toEqual({});
    expect(lynx.reportError).toHaveBeenCalledWith(error);
  });

  it('injects metadata until the first default processor call completes', () => {
    g.__I18N_RESOURCE_TRANSLATION__ = { hello: 'world' };
    g.__EXTRACT_STR__ = true;
    g.__EXTRACT_STR_IDENT_FLAG__ = '__extract__';

    const processData = createProcessData({
      dataProcessors: {
        named: (data: { value: number }) => ({ named: data.value }),
      },
    });

    expect(processData({ value: 1 }, 'named')).toEqual({
      named: 1,
      __I18N_RESOURCE_TRANSLATION__: { hello: 'world' },
      _EXTRACT_STR: '__extract__',
    });
    expect(processData({ value: 2 }, 'named')).toEqual({
      named: 2,
      __I18N_RESOURCE_TRANSLATION__: { hello: 'world' },
      _EXTRACT_STR: '__extract__',
    });
    expect(processData({ value: 3 })).toEqual({
      value: 3,
      __I18N_RESOURCE_TRANSLATION__: { hello: 'world' },
      _EXTRACT_STR: '__extract__',
    });
    expect(processData({ value: 4 })).toEqual({ value: 4 });
  });

  it('wraps processor execution with profile hooks when profiling is enabled', () => {
    g.__PROFILE__ = true;
    const processData = createProcessData({
      defaultDataProcessor: (data: { value: number }) => ({ value: data.value + 1 }),
    });

    expect(processData({ value: 1 })).toEqual({ value: 2 });
    expect(lynx.performance.profileStart).toHaveBeenCalledWith('processData');
    expect(lynx.performance.profileEnd).toHaveBeenCalledTimes(1);
  });
});
