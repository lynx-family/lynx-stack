// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  rstest,
  test,
} from '@rstest/core';
import { createPerformanceApis } from '../ts/client/background/background-apis/createPerformanceApis.js';
import { createMainThreadLynxPerformance } from '../ts/client/mainthread/createMainThreadLynxPerformance.js';
import type { TimingSystem } from '../ts/client/background/background-apis/createTimingSystem.js';

const originalPerformanceDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  'performance',
);

function createTimingSystemMock(): TimingSystem {
  return {
    markTimingInternal: rstest.fn(),
    pipelineIdToTimingFlags: new Map(),
    registerGlobalEmitter: rstest.fn(),
  };
}

function stubGlobalPerformance(performance: unknown): void {
  Object.defineProperty(globalThis, 'performance', {
    configurable: true,
    value: performance,
  });
}

function restoreGlobalPerformance(): void {
  if (originalPerformanceDescriptor) {
    Object.defineProperty(
      globalThis,
      'performance',
      originalPerformanceDescriptor,
    );
  } else {
    delete (globalThis as { performance?: Performance }).performance;
  }
}

function clearUserTimingEntries(): void {
  globalThis.performance?.clearMarks?.();
  globalThis.performance?.clearMeasures?.();
}

describe('createPerformanceApis', () => {
  beforeEach(() => {
    clearUserTimingEntries();
  });

  afterEach(() => {
    restoreGlobalPerformance();
    clearUserTimingEntries();
  });

  test('bridges profile traces and marks to browser User Timing entries', () => {
    const performanceApis = createPerformanceApis(createTimingSystemMock());

    const outerOption = {
      flowId: performanceApis.profileFlowId(),
      args: {
        componentName: 'App',
      },
    };
    const markOption = {
      flowId: performanceApis.profileFlowId(),
    };

    expect(performanceApis.isProfileRecording()).toBe(true);
    expect(markOption.flowId).toBe(2);

    performanceApis.profileStart('ReactLynx::outer', outerOption);
    performanceApis.profileMark('ReactLynx::mark', markOption);
    performanceApis.profileStart('ReactLynx::inner');
    performanceApis.profileEnd();
    performanceApis.profileEnd();

    const markEntries = performance.getEntriesByName(
      'ReactLynx::mark',
      'mark',
    ) as PerformanceMark[];
    expect(markEntries).toHaveLength(1);
    expect(markEntries[0]!.detail).toEqual(markOption);

    const innerMeasures = performance.getEntriesByName(
      'ReactLynx::inner',
      'measure',
    );
    expect(innerMeasures).toHaveLength(1);
    expect(innerMeasures[0]!.duration).toBeGreaterThanOrEqual(0);

    const outerMeasures = performance.getEntriesByName(
      'ReactLynx::outer',
      'measure',
    ) as PerformanceMeasure[];
    expect(outerMeasures).toHaveLength(1);
    expect(outerMeasures[0]!.duration).toBeGreaterThanOrEqual(
      innerMeasures[0]!.duration,
    );
    expect(outerMeasures[0]!.detail).toEqual(outerOption);

    expect(performance.getEntriesByType('mark').map(entry => entry.name))
      .not.toContain('lynx.profile:0:start:ReactLynx::outer');
  });

  test('ignores unmatched profileEnd calls', () => {
    const performanceApis = createPerformanceApis(createTimingSystemMock());

    expect(() => performanceApis.profileEnd()).not.toThrow();
    expect(performance.getEntriesByType('measure')).toHaveLength(0);
  });

  test('degrades to no-op profiling when User Timing is unavailable', () => {
    stubGlobalPerformance({});
    const performanceApis = createPerformanceApis(createTimingSystemMock());

    expect(performanceApis.isProfileRecording()).toBe(false);
    expect(performanceApis.profileFlowId()).toBe(1);
    expect(() => {
      performanceApis.profileStart('ReactLynx::trace');
      performanceApis.profileMark('ReactLynx::mark');
      performanceApis.profileEnd();
    }).not.toThrow();
  });
});

describe('main-thread lynx.performance', () => {
  beforeEach(() => {
    clearUserTimingEntries();
  });

  afterEach(() => {
    clearUserTimingEntries();
  });

  test('exposes profile and timing APIs to lifecycle handlers', () => {
    const markTiming = rstest.fn();
    const performanceApis = createMainThreadLynxPerformance(markTiming);

    expect(performanceApis.profileFlowId()).toBe(1);
    expect(() => {
      performanceApis.profileStart('ReactLynx::patch');
      performanceApis.profileEnd();
    }).not.toThrow();

    performanceApis._markTiming('pipeline-1', 'patchChangesStart');
    expect(markTiming).toHaveBeenCalledWith(
      'patchChangesStart',
      'pipeline-1',
    );
  });
});
