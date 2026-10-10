// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export interface OpenUILiveResponse {
  rawText: string;
  isStreaming: boolean;
}

export function readOpenUILiveResponse(
  value: unknown,
): OpenUILiveResponse | null {
  const response: unknown = Array.isArray(value) && value.length === 1
    ? value[0]
    : value;
  if (!response || typeof response !== 'object') return null;
  const payload = response as Partial<OpenUILiveResponse>;
  return typeof payload.rawText === 'string'
      && typeof payload.isStreaming === 'boolean'
    ? { rawText: payload.rawText, isStreaming: payload.isStreaming }
    : null;
}
