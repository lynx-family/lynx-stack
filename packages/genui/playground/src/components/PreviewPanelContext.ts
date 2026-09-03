// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { createContext } from 'react';

export type PreviewMode = 'phone' | 'full';

export interface PreviewPanelPreviewModeContextValue {
  mode: PreviewMode;
  setMode: (mode: PreviewMode) => void;
}

export const PreviewPanelPreviewModeContext = createContext<
  PreviewPanelPreviewModeContextValue | null
>(null);

export interface PreviewPanelRenderContextValue {
  htmlSource?: string;
  lynxXmlSource?: string;
  renderUrl: string;
}

export const PreviewPanelRenderContext = createContext<
  PreviewPanelRenderContextValue | null
>(null);

export interface PreviewPanelMetricsContextValue {
  metricId: string;
  onFrameSrcChange: (src: string) => void;
}

export const PreviewPanelMetricsContext = createContext<
  PreviewPanelMetricsContextValue | null
>(null);
