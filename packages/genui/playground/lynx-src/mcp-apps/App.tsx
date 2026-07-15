// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  McpApps,
  createAppRendererRegistry,
} from '@lynx-js/genui/mcp-apps/render';

import { PRODUCT_RENDERER } from './product/render.js';
import { WEATHER_RENDERER } from './weather/render.js';

const APP_RENDERER_REGISTRY = createAppRendererRegistry([
  WEATHER_RENDERER,
  PRODUCT_RENDERER,
]);

export function App() {
  return <McpApps registry={APP_RENDERER_REGISTRY} />;
}
