// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
export interface PreviewPayloadUrls {
  messagesUrl: string;
  actionMocksUrl?: string;
}

export interface PreviewPerformanceMetrics {
  fcpMs?: number;
  fmpMs?: number;
  ttiMs?: number;
  agentOutputMs?: number;
  renderMs?: number;
}
