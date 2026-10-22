// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { expect, rstest, test } from '@rstest/core';

import { createBenchGenerationTiming } from '../service/common/bench/timing.js';

test('measures earliest text across attempts, excluding reasoning and completion', () => {
  let now = 100;
  const clock = rstest.spyOn(performance, 'now').mockImplementation(() => now);
  try {
    const timing = createBenchGenerationTiming();
    now = 200;
    timing.observe('agent.model.first_reasoning_token');
    expect(timing.metrics()).toEqual({});
    now = 400;
    timing.observe('agent.model.first_text_token');
    now = 900;
    timing.observe('agent.model.first_text_token');
    timing.observe('agent.model.completed');
    expect(timing.metrics()).toEqual({ firstTextTokenMs: 300 });
  } finally {
    clock.mockRestore();
  }
});
