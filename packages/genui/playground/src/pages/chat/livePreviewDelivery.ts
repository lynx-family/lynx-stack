// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { RENDER_NAVIGATION_TOKEN_QUERY_PARAM } from '../../utils/previewFrameProtocol.js';

export type LivePreviewMessageType =
  | 'A2UI_ACTION_RESPONSE'
  | 'A2UI_LIVE_MESSAGES'
  | 'A2UI_REPLAY_MESSAGES';

export interface PendingLivePreviewOutput<TOutput> {
  type: LivePreviewMessageType;
  output: TOutput;
}

export function isMatchingLivePreviewFrame(
  expectedUrl: string,
  expectedWindow: unknown,
  currentUrl: string,
  currentWindow: unknown,
): boolean {
  return currentWindow !== null
    && currentWindow !== undefined
    && expectedUrl === currentUrl
    && expectedWindow === currentWindow;
}

export function isMatchingReadyLivePreviewFrame(
  isReady: boolean,
  readyUrl: string,
  readyWindow: unknown,
  currentUrl: string,
  currentWindow: unknown,
): boolean {
  return isReady && isMatchingLivePreviewFrame(
    readyUrl,
    readyWindow,
    currentUrl,
    currentWindow,
  );
}

export function queueOrDeliverLivePreviewOutput<TOutput>(
  pending: PendingLivePreviewOutput<TOutput>[],
  next: PendingLivePreviewOutput<TOutput>,
  deliver: (item: PendingLivePreviewOutput<TOutput>) => boolean,
): void {
  if (pending.length === 0 && deliver(next)) return;
  pending.push(next);
}

export function isA2UIRuntimeReadyMessage(
  value: unknown,
  expectedFrameUrl: string,
  expectedNavigationToken: string,
): value is {
  type: 'A2UI_RENDER_READY';
  runtimeReady: true;
  frameUrl: string;
  navigationToken: string;
} {
  if (value === null || typeof value !== 'object') return false;
  const message = value as {
    frameUrl?: unknown;
    navigationToken?: unknown;
    type?: unknown;
    runtimeReady?: unknown;
  };
  return message.type === 'A2UI_RENDER_READY'
    && message.runtimeReady === true
    && message.frameUrl === expectedFrameUrl
    && expectedNavigationToken.length > 0
    && message.navigationToken === expectedNavigationToken;
}

export function readLivePreviewNavigationToken(frameUrl: string): string {
  try {
    return new URL(frameUrl).searchParams.get(
      RENDER_NAVIGATION_TOKEN_QUERY_PARAM,
    ) ?? '';
  } catch {
    return '';
  }
}

/**
 * Collapse work queued while the preview frame boots into a current snapshot.
 * A replay supersedes all earlier deltas; otherwise create deltas are already
 * represented by `currentOutput`, while action deltas still need to be kept.
 */
export function prepareLivePreviewOutputs<TOutput>(
  currentOutput: TOutput | null,
  pending: readonly PendingLivePreviewOutput<TOutput>[],
): PendingLivePreviewOutput<TOutput>[] {
  for (let index = pending.length - 1; index >= 0; index--) {
    if (pending[index]?.type === 'A2UI_REPLAY_MESSAGES') {
      return pending.slice(index);
    }
  }

  if (currentOutput === null) return [...pending];

  return [
    { type: 'A2UI_REPLAY_MESSAGES', output: currentOutput },
    ...pending.filter((item) => item.type === 'A2UI_ACTION_RESPONSE'),
  ];
}
