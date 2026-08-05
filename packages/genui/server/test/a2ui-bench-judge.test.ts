// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from '@rstest/core';

import { buildJudgePrompt } from '../service/a2ui-bench-judge.js';

describe('bench visual judge prompt', () => {
  test('is protocol blind', () => {
    const prompt = buildJudgePrompt({
      id: 'weather',
      name: 'Weather card',
      prompt: 'Create a weather card with a Refresh action.',
      type: 'Information',
      action: 'Refresh',
    });

    expect(prompt).not.toContain('Protocol:');
    expect(prompt).toContain('Scenario: Weather card');
    expect(prompt).toContain(
      'Task: Create a weather card with a Refresh action.',
    );
    expect(prompt).toContain('Required visible action: Refresh');
  });
});
