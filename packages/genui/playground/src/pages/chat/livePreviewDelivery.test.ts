// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core';

import {
  isA2UIRuntimeReadyMessage,
  isMatchingLivePreviewFrame,
  isMatchingReadyLivePreviewFrame,
  prepareLivePreviewOutputs,
  queueOrDeliverLivePreviewOutput,
  readLivePreviewNavigationToken,
} from './livePreviewDelivery.js';

describe('live preview delivery', () => {
  test('waits for the A2UI store-ready signal', () => {
    const navigationToken = 'nav-a';
    const frameUrl =
      `https://example.com/render.html?previewNavigationToken=${navigationToken}`;
    expect(
      isA2UIRuntimeReadyMessage(
        {
          type: 'A2UI_RENDER_READY',
          runtimeReady: true,
          frameUrl,
          navigationToken,
        },
        frameUrl,
        navigationToken,
      ),
    ).toBe(true);
    expect(
      isA2UIRuntimeReadyMessage(
        {
          type: 'A2UI_RENDER_READY',
          runtimeReady: true,
          navigationToken,
        },
        frameUrl,
        navigationToken,
      ),
    ).toBe(false);
    expect(
      isA2UIRuntimeReadyMessage(
        {
          type: 'A2UI_RENDER_READY',
          runtimeReady: false,
          frameUrl,
          navigationToken,
        },
        frameUrl,
        navigationToken,
      ),
    ).toBe(false);
  });

  test('rejects a delayed ready signal from the previous navigation', () => {
    const previousFrameUrl =
      'https://example.com/render.html?previewNavigationToken=nav-a';
    const currentFrameUrl =
      'https://example.com/render.html?previewNavigationToken=nav-b';
    expect(
      isA2UIRuntimeReadyMessage(
        {
          type: 'A2UI_RENDER_READY',
          runtimeReady: true,
          frameUrl: previousFrameUrl,
          navigationToken: 'nav-a',
        },
        currentFrameUrl,
        'nav-b',
      ),
    ).toBe(false);
    expect(
      isA2UIRuntimeReadyMessage(
        {
          type: 'A2UI_RENDER_READY',
          runtimeReady: true,
          frameUrl: currentFrameUrl,
          navigationToken: 'nav-a',
        },
        currentFrameUrl,
        'nav-b',
      ),
    ).toBe(false);
  });

  test('reads the navigation token from the current frame URL', () => {
    expect(readLivePreviewNavigationToken(
      'https://example.com/render.html?previewNavigationToken=nav-a',
    )).toBe('nav-a');
    expect(readLivePreviewNavigationToken(
      'https://example.com/render.html',
    )).toBe('');
    expect(readLivePreviewNavigationToken('not a URL')).toBe('');
  });

  test('matches readiness to the current frame URL and window', () => {
    const readyWindow = {};
    expect(isMatchingReadyLivePreviewFrame(
      true,
      'https://example.com/render-a',
      readyWindow,
      'https://example.com/render-a',
      readyWindow,
    )).toBe(true);
    expect(isMatchingReadyLivePreviewFrame(
      true,
      'https://example.com/render-a',
      readyWindow,
      'https://example.com/render-b',
      readyWindow,
    )).toBe(false);
    expect(isMatchingReadyLivePreviewFrame(
      true,
      'https://example.com/render-a',
      readyWindow,
      'https://example.com/render-a',
      {},
    )).toBe(false);
  });

  test('rejects a fallback from a frame that has since navigated', () => {
    const frameWindow = {};
    expect(isMatchingLivePreviewFrame(
      'https://example.com/render-a',
      frameWindow,
      'https://example.com/render-b',
      frameWindow,
    )).toBe(false);
  });

  test('keeps new output behind earlier queued delivery', () => {
    const pending = [{
      type: 'A2UI_LIVE_MESSAGES' as const,
      output: ['first'],
    }];
    let deliveryAttempts = 0;
    queueOrDeliverLivePreviewOutput(
      pending,
      { type: 'A2UI_LIVE_MESSAGES', output: ['second'] },
      () => {
        deliveryAttempts += 1;
        return true;
      },
    );

    expect(deliveryAttempts).toBe(0);
    expect(pending).toEqual([
      { type: 'A2UI_LIVE_MESSAGES', output: ['first'] },
      { type: 'A2UI_LIVE_MESSAGES', output: ['second'] },
    ]);
  });

  test('only queues immediate delivery when posting fails', () => {
    const delivered: string[][] = [];
    const pending: Array<{
      type: 'A2UI_LIVE_MESSAGES';
      output: string[];
    }> = [];
    queueOrDeliverLivePreviewOutput(
      pending,
      { type: 'A2UI_LIVE_MESSAGES', output: ['delivered'] },
      (item) => {
        delivered.push(item.output);
        return true;
      },
    );
    queueOrDeliverLivePreviewOutput(
      pending,
      { type: 'A2UI_LIVE_MESSAGES', output: ['queued'] },
      () => false,
    );

    expect(delivered).toEqual([['delivered']]);
    expect(pending).toEqual([{
      type: 'A2UI_LIVE_MESSAGES',
      output: ['queued'],
    }]);
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
