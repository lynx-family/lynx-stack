/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { DecodedStyle } from '../client/wasm.js';
import type { PageConfig } from './PageConfig.js';

export interface DecodedTemplate {
  config?: PageConfig;
  styleInfo?: DecodedStyle;
  lepusCode?: Record<string, string>;
  elementTemplates?: any;
  customSections?: Record<string, any>;
  backgroundCode?: Record<string, string>;
}
