// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { PreviewFrameRenderer } from './PreviewViewport.js';

export interface LynxXmlPreviewFrameRequest {
  source: string;
  identity: string;
}

export type CreateLynxXmlPreviewFrame = (
  request: LynxXmlPreviewFrameRequest,
) => PreviewFrameRenderer;
