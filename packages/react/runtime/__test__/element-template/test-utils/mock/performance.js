// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { expect, vi } from 'vitest';

export const performance = {
  __functionCallHistory: [],
  _generatePipelineOptions: vi.fn(() => {
    performance.__functionCallHistory.push(['_generatePipelineOptions']);
    return {
      pipelineID: 'pipelineID',
      needTimestamps: false,
    };
  }),
  _onPipelineStart: vi.fn((id, options) => {
    if (typeof options === 'undefined') {
      performance.__functionCallHistory.push(['_onPipelineStart', id]);
    } else {
      performance.__functionCallHistory.push(['_onPipelineStart', id, options]);
    }
  }),
  _markTiming: vi.fn((id, key) => {
    performance.__functionCallHistory.push(['_markTiming', id, key]);
  }),
  _bindPipelineIdWithTimingFlag: vi.fn((id, flag) => {
    performance.__functionCallHistory.push(['_bindPipelineIdWithTimingFlag', id, flag]);
  }),

  profileStart: vi.fn(),
  profileEnd: vi.fn(),
  profileMark: vi.fn(),
  profileFlowId: vi.fn(() => 666),
  isProfileRecording: vi.fn(() => true),
};

export function installPerformanceGlobals() {
  if (!globalThis.lynx) {
    globalThis.lynx = {};
  }
  globalThis.lynx.performance = performance;

  console.profile = vi.fn();
  console.profileEnd = vi.fn();
}

export function resetPerformanceMocks() {
  // Access performance via globalThis.lynx which is set in globals.js
  const performance = globalThis.lynx.performance;
  if (performance && performance.profileStart && performance.profileEnd) {
    performance.profileStart.mockClear();
    performance.profileEnd.mockClear();
  }
}

export function checkPerformanceLeaks() {
  // check profile call times equal end call times
  expect(console.profile.mock.calls.length).toBe(
    console.profileEnd.mock.calls.length,
  );

  const performance = globalThis.lynx.performance;
  if (performance && performance.profileStart && performance.profileEnd) {
    expect(performance.profileStart.mock.calls.length).toBe(
      performance.profileEnd.mock.calls.length,
    );
  }
}
