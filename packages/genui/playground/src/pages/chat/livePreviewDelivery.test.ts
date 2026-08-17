// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core';

import {
  isA2UIRuntimeReadyMessage,
  prepareLivePreviewOutputs,
} from './livePreviewDelivery.js';

describe('live preview delivery', () => {
  test('waits for the A2UI store-ready signal', () => {
    expect(
      isA2UIRuntimeReadyMessage({
        type: 'A2UI_RENDER_READY',
        runtimeReady: true,
      }),
    ).toBe(true);
    expect(isA2UIRuntimeReadyMessage({ type: 'A2UI_RENDER_READY' })).toBe(
      false,
    );
    expect(
      isA2UIRuntimeReadyMessage({
        type: 'A2UI_RENDER_READY',
        runtimeReady: false,
      }),
    ).toBe(false);
  });

  test('replays the latest accumulated output and drops included live deltas', () => {
    expect(prepareLivePreviewOutputs(['surface', 'delta-1', 'delta-2'], [
      { type: 'A2UI_LIVE_MESSAGES', output: ['delta-1'] },
      { type: 'A2UI_LIVE_MESSAGES', output: ['delta-2'] },
    ])).toEqual([{
      type: 'A2UI_REPLAY_MESSAGES',
      output: ['surface', 'delta-1', 'delta-2'],
    }]);
  });

  test('preserves action deltas after replaying the current surface', () => {
    expect(prepareLivePreviewOutputs(['surface'], [
      { type: 'A2UI_ACTION_RESPONSE', output: ['action-1'] },
      { type: 'A2UI_ACTION_RESPONSE', output: ['action-2'] },
    ])).toEqual([
      { type: 'A2UI_REPLAY_MESSAGES', output: ['surface'] },
      { type: 'A2UI_ACTION_RESPONSE', output: ['action-1'] },
      { type: 'A2UI_ACTION_RESPONSE', output: ['action-2'] },
    ]);
  });

  test('uses the last authoritative replay and discards older queued work', () => {
    expect(prepareLivePreviewOutputs(['final'], [
      { type: 'A2UI_LIVE_MESSAGES', output: ['delta'] },
      { type: 'A2UI_ACTION_RESPONSE', output: ['action'] },
      { type: 'A2UI_REPLAY_MESSAGES', output: ['final'] },
    ])).toEqual([{
      type: 'A2UI_REPLAY_MESSAGES',
      output: ['final'],
    }]);
  });
});
