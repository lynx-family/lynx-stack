/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { PageConfig } from './PageConfig.js';
import type { StyleSheetResource } from '../../binary/client/client.js';

export interface DecodedTemplate {
  config?: PageConfig;
  lepusCode?: Record<string, string>;
  customSections?: Record<string, any>;
  backgroundCode?: Record<string, string>;
  styleSheet?: StyleSheetResource;
}
